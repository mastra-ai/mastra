import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export type StorageConfig = Readonly<{
  url: string;
  authToken?: string;
}>;

export function resolveStorageUrl(value: string, projectDirectory = process.env.INIT_CWD ?? process.cwd()): string {
  if (!value.startsWith('file:') || value === 'file::memory:') return value;

  const filePath = value.slice('file:'.length);
  if (!filePath || filePath.startsWith('//') || isAbsolute(filePath)) {
    return value;
  }

  return pathToFileURL(resolve(projectDirectory, filePath)).href;
}

export function readStorageConfig(
  environment: NodeJS.ProcessEnv = process.env,
  projectDirectory = environment.INIT_CWD ?? process.cwd(),
): StorageConfig {
  const configuredUrl = environment.MASTRA_STORAGE_URL ?? 'file:./mastra.db';
  if (!configuredUrl || configuredUrl.trim() !== configuredUrl) {
    throw new Error('MASTRA_STORAGE_URL must be a nonempty database URL without surrounding whitespace.');
  }
  const url = resolveStorageUrl(configuredUrl, projectDirectory);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('MASTRA_STORAGE_URL must be a valid file, LibSQL or HTTP/WebSocket URL.');
  }
  if (
    !['file:', 'libsql:', 'https:', 'http:', 'wss:', 'ws:'].includes(parsed.protocol) ||
    (parsed.protocol !== 'file:' && !parsed.hostname) ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error(
      'MASTRA_STORAGE_URL must use a supported database protocol without embedded credentials. Use MASTRA_STORAGE_AUTH_TOKEN for authentication.',
    );
  }
  const authToken = environment.MASTRA_STORAGE_AUTH_TOKEN;
  if (authToken && authToken.trim() !== authToken) {
    throw new Error('MASTRA_STORAGE_AUTH_TOKEN must not contain surrounding whitespace.');
  }

  return Object.freeze({
    url,
    ...(authToken ? { authToken } : {}),
  });
}
