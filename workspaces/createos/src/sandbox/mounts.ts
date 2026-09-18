import { createHash } from 'node:crypto';

import type { FilesystemMountConfig } from '@mastra/core/workspace';
import type { DiskConfig, DiskCredentials } from '@nodeops-createos/sandbox';

const SAFE_MOUNT_PATH = /^\/[a-zA-Z0-9_.\-/]+$/;
const RESERVED_MOUNT_PATHS = new Set([
  '/',
  '/bin',
  '/boot',
  '/dev',
  '/etc',
  '/lib',
  '/proc',
  '/root',
  '/run',
  '/sbin',
  '/sys',
  '/tmp',
  '/usr',
  '/var',
]);

export interface CreateOSS3MountConfig extends FilesystemMountConfig {
  type: 's3';
  bucket: string;
  region?: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  prefix?: string;
  readOnly?: boolean;
}

export interface ResolvedCreateOSDisk {
  name: string;
  config: DiskConfig;
  credentials: DiskCredentials;
  subPath?: string;
}

export function validateMountPath(mountPath: string): void {
  if (mountPath.length > 512 || !SAFE_MOUNT_PATH.test(mountPath)) {
    throw new Error(
      `Invalid mount path: ${mountPath}. Must be an absolute path of at most 512 characters using alphanumeric, dash, dot, underscore, or slash characters.`,
    );
  }
  const segments = mountPath.split('/');
  if (mountPath.includes('//') || segments.some(segment => segment === '.' || segment === '..')) {
    throw new Error(`Invalid mount path: ${mountPath}. Path traversal segments are not allowed.`);
  }
  const normalized = mountPath.length > 1 && mountPath.endsWith('/') ? mountPath.slice(0, -1) : mountPath;
  const firstSegment = segments[1];
  if (
    RESERVED_MOUNT_PATHS.has(normalized) ||
    firstSegment === 'proc' ||
    firstSegment === 'sys' ||
    firstSegment === 'dev'
  ) {
    throw new Error(`Invalid mount path: ${mountPath}. Mounting over system paths is not allowed.`);
  }
}

function normalizeEndpoint(endpoint: string | undefined, region: string | undefined): string {
  if (!endpoint) {
    if (region === 'auto') {
      throw new Error('An S3 endpoint is required when region is "auto".');
    }
    return `https://s3.${region ?? 'us-east-1'}.amazonaws.com`;
  }

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error(`Invalid S3 endpoint URL: "${endpoint}".`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Invalid S3 endpoint scheme: "${url.protocol}". Only http: and https: are allowed.`);
  }
  return endpoint.replace(/\/+$/, '');
}

function normalizePrefix(prefix: string | undefined): string | undefined {
  if (!prefix) return undefined;
  const normalized = prefix.replace(/^\/+|\/+$/g, '');
  if (!normalized) return undefined;
  if (normalized.includes('..') || normalized.startsWith('-') || /[\x00-\x1f\x7f]/.test(normalized)) {
    throw new Error(`Invalid S3 mount prefix: "${prefix}".`);
  }
  return normalized;
}

export function resolveCreateOSDisk(config: CreateOSS3MountConfig): ResolvedCreateOSDisk {
  if (!config.bucket?.trim()) throw new Error('S3 mount configuration requires a bucket.');
  if (!config.accessKeyId || !config.secretAccessKey) {
    throw new Error('CreateOS S3 mounts require static accessKeyId and secretAccessKey credentials.');
  }
  if (config.sessionToken) {
    throw new Error('CreateOS S3 disks do not currently support temporary session-token credentials.');
  }
  if (config.readOnly) {
    throw new Error('CreateOS S3 disks do not currently support read-only mounts.');
  }
  if (/[\x00-\x1f\x7f]/.test(config.accessKeyId) || /[\x00-\x1f\x7f]/.test(config.secretAccessKey)) {
    throw new Error('CreateOS S3 mount credentials must not contain control characters.');
  }

  const endpoint = normalizeEndpoint(config.endpoint, config.region);
  const diskConfig: DiskConfig = {
    bucket: config.bucket,
    endpoint,
    ...(config.region && { region: config.region }),
    ...(config.endpoint && { use_path_style: true }),
  };
  const identity = JSON.stringify({ ...diskConfig, accessKeyId: config.accessKeyId });
  const digest = createHash('sha256').update(identity).digest('hex').slice(0, 24);
  const subPath = normalizePrefix(config.prefix);

  return {
    name: `mastra-s3-${digest}`,
    config: diskConfig,
    credentials: {
      access_key: config.accessKeyId,
      secret_key: config.secretAccessKey,
    },
    ...(subPath && { subPath }),
  };
}

export function sameDiskConfig(left: DiskConfig, right: DiskConfig): boolean {
  return (
    left.bucket === right.bucket &&
    left.endpoint.replace(/\/+$/, '') === right.endpoint.replace(/\/+$/, '') &&
    (left.region ?? undefined) === (right.region ?? undefined) &&
    Boolean(left.use_path_style) === Boolean(right.use_path_style)
  );
}

export function errorToString(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
