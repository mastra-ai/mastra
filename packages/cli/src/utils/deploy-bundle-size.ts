import { readdir, lstat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Bundles above this size get a warning listing the largest output entries. */
export const BUNDLE_WARN_BYTES = 100 * 1024 * 1024;

const LARGEST_ENTRY_COUNT = 5;
const CONTENT_LENGTH_RANGE_HEADER = 'x-goog-content-length-range';

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

async function pathSize(path: string): Promise<number> {
  const info = await lstat(path);
  if (!info.isDirectory()) return info.size;
  const entries = await readdir(path);
  let total = 0;
  for (const entry of entries) {
    total += await pathSize(join(path, entry));
  }
  return total;
}

/**
 * Largest top-level entries under the build output, by recursive (uncompressed) size.
 * `node_modules` is skipped because it is never added to the deploy archive.
 */
export async function largestOutputEntries(
  outputDir: string,
  limit = LARGEST_ENTRY_COUNT,
): Promise<{ name: string; bytes: number }[]> {
  const entries = await readdir(outputDir).catch(() => [] as string[]);
  const sized = await Promise.all(
    entries
      .filter(name => name !== 'node_modules')
      .map(async name => ({ name, bytes: await pathSize(join(outputDir, name)) })),
  );
  return sized.sort((a, b) => b.bytes - a.bytes).slice(0, limit);
}

async function describeLargestEntries(outputDir: string): Promise<string> {
  const entries = await largestOutputEntries(outputDir);
  const lines = entries.map(e => `  ${formatBytes(e.bytes).padStart(9)}  ${e.name}`);
  return [
    'Largest entries in .mastra/output (uncompressed):',
    ...lines,
    'Common causes: a stray repo clone, a copied node_modules, or large media in public/.',
  ].join('\n');
}

/**
 * Warns above {@link BUNDLE_WARN_BYTES} with the largest output entries. The hard
 * limit is enforced by the platform (413), so this never blocks a deploy.
 */
export async function checkBundleSize(opts: {
  artifactBytes: number;
  outputDir: string;
  warn: (message: string) => void;
}): Promise<void> {
  if (opts.artifactBytes <= BUNDLE_WARN_BYTES) return;
  const summary = `Deploy bundle is ${formatBytes(opts.artifactBytes)}, which is unusually large.`;
  const listing = await describeLargestEntries(opts.outputDir).catch(() => null);
  opts.warn(listing ? `${summary}\n${listing}` : summary);
}

/**
 * Headers for the artifact PUT. The content-length-range header is only added when
 * the platform signed it into the URL; sending an unsigned header breaks the signature.
 */
export function artifactUploadHeaders(uploadUrl: string, artifactBytes: number): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/zip' };
  let signedHeaders: string | null = null;
  try {
    const params = new URL(uploadUrl).searchParams;
    signedHeaders = params.get('X-Goog-SignedHeaders') ?? params.get('x-goog-signedheaders');
  } catch {
    signedHeaders = null;
  }
  if (signedHeaders?.toLowerCase().split(';').includes(CONTENT_LENGTH_RANGE_HEADER)) {
    headers[CONTENT_LENGTH_RANGE_HEADER] = `0,${artifactBytes}`;
  }
  return headers;
}

/**
 * Upload the deploy artifact to the URL returned by a create-deploy endpoint.
 * `file://` URLs (local platform dev) are written directly to disk.
 */
export async function uploadArtifact(uploadUrl: string, zipBuffer: Buffer): Promise<void> {
  if (uploadUrl.startsWith('file://')) {
    await writeFile(fileURLToPath(uploadUrl), Buffer.from(zipBuffer));
    return;
  }

  const size = formatBytes(zipBuffer.byteLength);
  let resp: Response;
  try {
    resp = await fetch(uploadUrl, {
      method: 'PUT',
      headers: artifactUploadHeaders(uploadUrl, zipBuffer.byteLength),
      body: new Uint8Array(zipBuffer.buffer, zipBuffer.byteOffset, zipBuffer.byteLength),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Upload of ${size} bundle failed: ${reason}`);
  }
  if (!resp.ok) {
    throw new Error(`Upload of ${size} bundle failed: ${resp.status} ${resp.statusText}`);
  }
}
