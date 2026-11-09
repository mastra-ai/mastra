import { relative, resolve } from 'node:path';

import type { S3Client } from '@aws-sdk/client-s3';
import type { AnyWorkspace, WorkspaceFilesystem } from '@mastra/core/workspace';
import { LocalFilesystem, Workspace } from '@mastra/core/workspace';
import type { GoogleDriveFilesystemOptions } from '@mastra/google-drive';
import { GoogleDriveFilesystem } from '@mastra/google-drive';

import type { CatalogSource, S3Source, SourceCatalog } from './catalog.js';
import { normalizeMountPath, validateCatalog } from './catalog.js';
import type { DriveAccessToken } from './drive-source.js';
import { ScopedDriveReader } from './drive-source.js';
import { validateAndPersistSourceIdentity } from './identity-ledger.js';
import { BoundedS3Filesystem, MAX_INSPECTION_BYTES, ScopedS3Reader } from './s3-source.js';

type SourceStatus = 'available' | 'configured' | 'unavailable';
type SourceFilesystem = WorkspaceFilesystem;
type DriveFilesystemFactory = (options: GoogleDriveFilesystemOptions) => WorkspaceFilesystem;
/** Test-only public client configuration; production always uses Mastra's native client. */
type S3ClientFactory = (client: S3Client, source: S3Source) => void;

export type SourceInspection = {
  sourceId: string;
  mountPath: string;
  status: SourceStatus;
  content?: string;
  error?: string;
};

export type SourceRuntime = {
  catalog: SourceCatalog;
  workspace: AnyWorkspace;
  driveReaders: Map<string, ScopedDriveReader>;
  s3Readers: Map<string, ScopedS3Reader>;
  inspect: (sourceId: string, relativePath: string) => Promise<SourceInspection>;
  sourceStatuses: () => Array<Omit<SourceInspection, 'content'>>;
};

type Credentials = { clientEmail: string; privateKey: string } | undefined;

function configuredDriveCredentials(environment: NodeJS.ProcessEnv): Credentials {
  const clientEmail = environment.GOOGLE_DRIVE_CLIENT_EMAIL?.trim();
  const privateKey = environment.GOOGLE_DRIVE_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();
  if (!clientEmail && !privateKey) return undefined;
  if (!clientEmail || !privateKey)
    throw new Error('Google Drive credentials are incomplete. Provide both accepted Drive credential settings.');
  return { clientEmail, privateKey };
}

function configuredS3Credentials(environment: NodeJS.ProcessEnv) {
  const accessKeyId = environment.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = environment.S3_SECRET_ACCESS_KEY?.trim();
  if (!accessKeyId && !secretAccessKey) return undefined;
  if (!accessKeyId || !secretAccessKey)
    throw new Error('S3 credentials are incomplete. Provide both accepted S3 credential settings.');
  return { accessKeyId, secretAccessKey };
}

function safeError(source: CatalogSource): string {
  if (source.provider === 'google-drive')
    return `Source ${source.id} is unavailable. Confirm its configured credentials and folder access.`;
  if (source.provider === 's3')
    return `Source ${source.id} is unavailable. Confirm its configured credentials and bucket access.`;
  return `Source ${source.id} is unavailable. Confirm its configured local root.`;
}

function safeRelativePath(relativePath: string): string {
  if (
    !relativePath ||
    relativePath.startsWith('/') ||
    relativePath.includes('\\') ||
    relativePath.includes('\0') ||
    relativePath.split('/').some(segment => segment === '.' || segment === '..')
  ) {
    throw new Error('Requested path must be a non-empty path contained within its source mount.');
  }
  return relativePath;
}

function mountedPath(source: CatalogSource, relativePath: string): string {
  return `${normalizeMountPath(source.mountPath)}/${safeRelativePath(relativePath)}`;
}

function localRoot(source: Extract<CatalogSource, { provider: 'local' }>, catalogPath: string): string {
  return resolve(catalogPath, '..', source.root);
}

function freezeCatalog(catalog: SourceCatalog): SourceCatalog {
  for (const source of catalog.sources) Object.freeze(source);
  Object.freeze(catalog.sources);
  return Object.freeze(catalog);
}

export async function createSourceRuntime(options: {
  catalog: SourceCatalog;
  catalogPath: string;
  ledgerPath: string;
  environment?: NodeJS.ProcessEnv;
  driveFilesystemFactory?: DriveFilesystemFactory;
  driveAccessToken?: DriveAccessToken;
  driveRequest?: typeof fetch;
  configureS3Client?: S3ClientFactory;
}): Promise<SourceRuntime> {
  const environment = options.environment ?? process.env;
  const catalog = freezeCatalog(await validateCatalog(options.catalog, options.catalogPath));
  const enabledSources = catalog.sources.filter(source => source.enabled);
  const credentials = configuredDriveCredentials(environment);
  const s3Credentials = configuredS3Credentials(environment);
  if (enabledSources.some(source => source.provider === 'google-drive') && !credentials) {
    throw new Error('Enabled Google Drive sources require both accepted Drive credential settings.');
  }
  if (enabledSources.some(source => source.provider === 's3') && !s3Credentials) {
    throw new Error('Enabled S3 sources require both accepted S3 credential settings.');
  }
  await validateAndPersistSourceIdentity(options.ledgerPath, enabledSources);
  const filesystems = new Map<string, SourceFilesystem>();
  const statuses = new Map<string, SourceStatus>();
  const mounts: Record<string, SourceFilesystem> = {};
  const driveReaders = new Map<string, ScopedDriveReader>();
  const s3Readers = new Map<string, ScopedS3Reader>();
  const getAccessToken =
    options.driveAccessToken ?? (credentials ? ScopedDriveReader.serviceAccount(credentials) : undefined);

  for (const source of enabledSources) {
    const mountPath = normalizeMountPath(source.mountPath);
    if (source.provider === 'local') {
      const filesystem = new LocalFilesystem({
        id: source.id,
        basePath: localRoot(source, options.catalogPath),
        contained: true,
        readOnly: true,
      });
      await filesystem.init();
      filesystems.set(source.id, filesystem);
      mounts[mountPath] = filesystem;
      statuses.set(source.id, 'available');
      continue;
    }

    if (source.provider === 's3') {
      const filesystem = new BoundedS3Filesystem(
        {
          id: source.id,
          bucket: source.bucket,
          region: source.region,
          endpoint: source.endpoint,
          prefix: source.prefix,
          readOnly: true,
          // Explicit credentials prevent the upstream client's ambient provider chain.
          credentials: s3Credentials,
        },
        source,
      );
      options.configureS3Client?.(filesystem.client, source);
      filesystems.set(source.id, filesystem);
      mounts[mountPath] = filesystem;
      s3Readers.set(source.id, new ScopedS3Reader(source, filesystem.client));
      statuses.set(source.id, options.configureS3Client ? 'available' : 'configured');
      continue;
    }

    const driveOptions: GoogleDriveFilesystemOptions = {
      id: source.id,
      folderId: source.folderId,
      readOnly: true,
      getAccessToken,
    };
    const filesystem = options.driveFilesystemFactory?.(driveOptions) ?? new GoogleDriveFilesystem(driveOptions);
    if (getAccessToken)
      driveReaders.set(source.id, new ScopedDriveReader(source.folderId, getAccessToken, options.driveRequest));
    filesystems.set(source.id, filesystem);
    mounts[mountPath] = filesystem;
    if (options.driveFilesystemFactory) {
      try {
        await filesystem.init?.();
        statuses.set(source.id, 'available');
      } catch {
        statuses.set(source.id, 'unavailable');
      }
    } else {
      statuses.set(source.id, credentials ? 'configured' : 'unavailable');
    }
  }

  const workspace = new Workspace({
    id: 'organization-intelligence-sources',
    mounts,
    tools: { enabled: false },
  });

  return {
    catalog,
    workspace,
    driveReaders,
    s3Readers,
    sourceStatuses: () =>
      enabledSources.map(source => ({
        sourceId: source.id,
        mountPath: normalizeMountPath(source.mountPath),
        status: statuses.get(source.id) ?? 'unavailable',
        ...(statuses.get(source.id) === 'unavailable' ? { error: safeError(source) } : {}),
      })),
    inspect: async (sourceId, relativePath) => {
      const source = enabledSources.find(candidate => candidate.id === sourceId);
      const filesystem = filesystems.get(sourceId);
      if (!source || !filesystem) throw new Error('Requested source is not active in the startup catalog.');
      const path = mountedPath(source, relativePath);

      if (source.provider === 'local') {
        const root = localRoot(source, options.catalogPath);
        const resolved = resolve(root, relativePath);
        if (relative(root, resolved).startsWith('..')) {
          throw new Error('Requested path must be contained within its source mount.');
        }
      }

      try {
        if (source.provider === 'google-drive' && statuses.get(source.id) !== 'available') {
          await filesystem.init?.();
          statuses.set(source.id, 'available');
        }
        const workspaceFilesystem = workspace.filesystem;
        if (!workspaceFilesystem) throw new Error('Configured source mounts are unavailable.');
        const metadata = await workspaceFilesystem.stat(path);
        if (metadata.size > MAX_INSPECTION_BYTES) {
          return {
            sourceId,
            mountPath: normalizeMountPath(source.mountPath),
            status: 'available',
            error: `Record exceeds the ${MAX_INSPECTION_BYTES / 1024} KiB inspection limit.`,
          };
        }
        const content = await workspaceFilesystem.readFile(path, { encoding: 'utf8' });
        if (Buffer.byteLength(content) > MAX_INSPECTION_BYTES) throw new Error('Record exceeds inspection limit.');
        statuses.set(source.id, 'available');
        return {
          sourceId,
          mountPath: normalizeMountPath(source.mountPath),
          status: 'available',
          content: String(content),
        };
      } catch {
        statuses.set(source.id, 'unavailable');
        return {
          sourceId,
          mountPath: normalizeMountPath(source.mountPath),
          status: 'unavailable',
          error: safeError(source),
        };
      }
    },
  };
}

export { MAX_INSPECTION_BYTES };
