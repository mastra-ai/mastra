import { readFile, realpath, stat } from 'node:fs/promises';
import { isAbsolute, normalize, resolve } from 'node:path';
import { z } from 'zod';

import { catalogSourceSchema } from './source-providers.ts';
export { sourceIdentity } from './source-providers.ts';
export type { CatalogSource, S3Source } from './source-providers.ts';

const catalogSchema = z.object({
  version: z.literal(1),
  sources: z.array(catalogSourceSchema).min(1),
});

export type SourceCatalog = z.infer<typeof catalogSchema>;

export class CatalogValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CatalogValidationError';
  }
}

export function normalizeMountPath(mountPath: string): string {
  if (mountPath.includes('\\') || mountPath.includes('\0')) {
    throw new CatalogValidationError('Mount paths may not contain backslashes or control characters.');
  }
  if (!mountPath.startsWith('/')) throw new CatalogValidationError('Mount paths must begin with /.');
  if (mountPath.split('/').some(segment => segment === '.' || segment === '..')) {
    throw new CatalogValidationError('Mount paths may not contain relative segments.');
  }
  const normalized = normalize(mountPath).replace(/\\/g, '/');
  if (normalized === '/' || normalized.includes('..')) {
    throw new CatalogValidationError('Mount paths must name a contained non-root path.');
  }
  return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
}

export function normalizeS3Prefix(prefix: string | undefined): string {
  if (!prefix) return '';
  if (prefix.includes('\\') || /[\0-\x1f\x7f]/.test(prefix) || prefix.startsWith('/') || prefix.includes('//')) {
    throw new CatalogValidationError('S3 prefixes must be relative paths without control characters.');
  }
  const parts = prefix.replace(/\/$/, '').split('/');
  if (!parts.length || parts.some(part => unsafeS3Segment(part)))
    throw new CatalogValidationError('S3 prefixes must not contain relative segments.');
  return parts.join('/') + '/';
}

function unsafeS3Segment(segment: string): boolean {
  if (!segment || segment === '.' || segment === '..') return true;
  let decoded = segment;
  for (let depth = 0; depth < 3; depth++) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }
  return decoded === '.' || decoded === '..' || /[\\/\0-\x1f\x7f]/.test(decoded);
}

export function normalizeR2Endpoint(endpoint: string): string {
  if (/[%]2e|[%]2f|[%]5c|[\\\0-\x1f\x7f]/i.test(endpoint))
    throw new CatalogValidationError('S3 endpoints may not contain encoded or relative path aliases.');
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new CatalogValidationError('S3 endpoints must be valid HTTPS R2 endpoints.');
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash ||
    url.pathname !== '/' ||
    !/^[a-z0-9-]+(?:\.(?:eu|fedramp|us))?\.r2\.cloudflarestorage\.com$/i.test(url.hostname)
  ) {
    throw new CatalogValidationError('S3 endpoints must be recognized HTTPS Cloudflare R2 account endpoints.');
  }
  return url.origin.toLowerCase();
}

export async function validateCatalog(input: unknown, catalogPath: string): Promise<SourceCatalog> {
  const parsed = catalogSchema.safeParse(input);
  if (!parsed.success) throw new CatalogValidationError('Source catalog has an invalid source entry.');
  const sourceCatalog = parsed.data;
  const sourceIds = new Set<string>();
  const mountPaths = new Set<string>();
  const driveRoots = new Set<string>();
  const localRoots = new Set<string>();
  const s3Roots: Array<{ endpoint: string; bucket: string; prefix: string }> = [];
  const catalogDirectory = resolve(catalogPath, '..');

  for (const source of sourceCatalog.sources) {
    if (sourceIds.has(source.id)) throw new CatalogValidationError(`Duplicate source id: ${source.id}.`);
    sourceIds.add(source.id);

    const mountPath = normalizeMountPath(source.mountPath);
    if (mountPaths.has(mountPath)) throw new CatalogValidationError(`Duplicate mount path: ${mountPath}.`);
    for (const existingMount of mountPaths) {
      if (mountPath.startsWith(`${existingMount}/`) || existingMount.startsWith(`${mountPath}/`)) {
        throw new CatalogValidationError(`Source mount paths must not overlap: ${existingMount} and ${mountPath}.`);
      }
    }
    mountPaths.add(mountPath);

    if (source.provider === 'local') {
      const sourceRoot = isAbsolute(source.root) ? source.root : resolve(catalogDirectory, source.root);
      source.root = sourceRoot;
      if (!source.enabled) continue;
      try {
        source.root = await realpath(sourceRoot);
        if (!(await stat(source.root)).isDirectory()) throw new Error('Not a directory.');
      } catch {
        throw new CatalogValidationError(`Local source ${source.id} root is inaccessible or is not a directory.`);
      }
      for (const existing of localRoots) {
        if (
          source.root === existing ||
          source.root.startsWith(`${existing}/`) ||
          existing.startsWith(`${source.root}/`)
        ) {
          throw new CatalogValidationError('Local source roots must not overlap.');
        }
      }
      localRoots.add(source.root);
      continue;
    }

    if (source.provider === 'google-drive') {
      if (driveRoots.has(source.folderId)) {
        throw new CatalogValidationError(`Duplicate Google Drive folder root for source ${source.id}.`);
      }
      driveRoots.add(source.folderId);
      continue;
    }

    const endpoint = normalizeR2Endpoint(source.endpoint);
    const prefix = normalizeS3Prefix(source.prefix);
    for (const root of s3Roots) {
      if (
        root.endpoint === endpoint &&
        root.bucket === source.bucket &&
        (prefix.startsWith(root.prefix) || root.prefix.startsWith(prefix))
      ) {
        throw new CatalogValidationError('S3 source prefixes must not overlap within an endpoint and bucket.');
      }
    }
    s3Roots.push({ endpoint, bucket: source.bucket, prefix });
    source.endpoint = endpoint;
    source.prefix = prefix || undefined;
  }

  return {
    ...sourceCatalog,
    sources: sourceCatalog.sources.map(source => ({
      ...source,
      mountPath: normalizeMountPath(source.mountPath),
      ...(source.provider === 's3'
        ? { endpoint: normalizeR2Endpoint(source.endpoint), prefix: normalizeS3Prefix(source.prefix) || undefined }
        : {}),
    })),
  };
}

export async function loadCatalog(catalogPath: string): Promise<SourceCatalog> {
  let content: string;
  try {
    content = await readFile(catalogPath, 'utf8');
  } catch {
    throw new CatalogValidationError(
      'Source catalog could not be read. Check source-catalog.json in the project directory.',
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new CatalogValidationError('Source catalog must be valid JSON.');
  }

  return validateCatalog(parsed, catalogPath);
}

export function validateEnvironment(catalog: SourceCatalog, environment: NodeJS.ProcessEnv): string[] {
  const issues: string[] = [];
  if (!environment.OPENAI_API_KEY?.trim())
    issues.push('OPENAI_API_KEY is required for the default OpenAI local server.');
  const clientEmail = environment.GOOGLE_DRIVE_CLIENT_EMAIL?.trim();
  const privateKey = environment.GOOGLE_DRIVE_PRIVATE_KEY?.trim();
  if ((clientEmail && !privateKey) || (!clientEmail && privateKey)) {
    issues.push('Google Drive credentials are incomplete. Provide both accepted Drive credential settings.');
  }
  if (
    catalog.sources.some(source => source.enabled && source.provider === 'google-drive') &&
    (!clientEmail || !privateKey)
  ) {
    issues.push('Enabled Google Drive sources require both accepted Drive credential settings.');
  }
  const s3AccessKey = environment.S3_ACCESS_KEY_ID?.trim();
  const s3Secret = environment.S3_SECRET_ACCESS_KEY?.trim();
  if ((s3AccessKey && !s3Secret) || (!s3AccessKey && s3Secret)) {
    issues.push('S3 credentials are incomplete. Provide both accepted S3 credential settings.');
  }
  if (catalog.sources.some(source => source.enabled && source.provider === 's3') && (!s3AccessKey || !s3Secret)) {
    issues.push('Enabled S3 sources require both accepted S3 credential settings.');
  }
  return issues;
}
