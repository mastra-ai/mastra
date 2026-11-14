import { Readable } from 'node:stream';
import { createGunzip, gzipSync } from 'node:zlib';
import { extract, pack } from 'tar-stream';
import { expect } from 'vitest';

export function secretScanner(values: string[]) {
  const variants = values
    .flatMap(value => [
      value,
      Buffer.from(value).toString('base64'),
      Buffer.from(value).toString('hex'),
      Buffer.from(value).toString('base64url'),
      encodeURIComponent(value),
      [...Buffer.from(value)].map(byte => `%${byte.toString(16).padStart(2, '0')}`).join(''),
      [...value].map(char => `&#${char.charCodeAt(0)};`).join(''),
      [...value].map(char => `&#x${char.charCodeAt(0).toString(16)};`).join(''),
    ])
    .map(value => Buffer.from(value));
  const overlap = Math.max(...variants.map(value => value.length)) - 1;
  let tail = Buffer.alloc(0);
  return (chunk: Buffer) => {
    const combined = Buffer.concat([tail, chunk]);
    if (variants.some(value => combined.includes(value))) throw new Error('PROHIBITED_IMAGE_CONTENT');
    tail = Buffer.from(combined.subarray(Math.max(0, combined.length - overlap)));
  };
}

// Docker save may export legacy layer.tar entries or OCI blobs. Inspect every
// file, decompress gzip layers, and reject unsupported compression explicitly.
/** Inspect an exported image archive for forbidden credential representations in files and layers. */
export async function auditImageArchive(stream: Readable, values: string[]) {
  const parser = extract();
  let archiveBytes = 0,
    decodedBytes = 0,
    files = 0;
  const formats: Record<string, number> = {};
  const fail = (error: Error) => {
    stream.destroy(error);
    parser.destroy(error);
  };
  const timer = setTimeout(() => fail(new Error('IMAGE_AUDIT_TIMEOUT')), 120000);
  const completed = new Promise<void>((resolve, reject) => {
    parser.once('finish', resolve);
    parser.once('error', reject);
    stream.once('error', reject);
  });
  parser.on('entry', (header, entry, next) => {
    void (async () => {
      if (++files > 4096) throw new Error('IMAGE_ENTRY_BOUND');
      if (header.type !== 'file') {
        entry.resume();
        entry.once('end', next);
        return;
      }
      const iterator = entry[Symbol.asyncIterator]();
      let prefix = Buffer.alloc(0);
      while (prefix.length < 512) {
        const part = await iterator.next();
        if (part.done) break;
        if (!Buffer.isBuffer(part.value)) throw new Error('IMAGE_CHUNK_INVALID');
        prefix = Buffer.concat([prefix, part.value]);
        if (prefix.length > 1048576) throw new Error('IMAGE_PREFIX_BOUND');
      }
      const input = Readable.from(
        (async function* () {
          yield prefix;
          while (true) {
            const part = await iterator.next();
            if (part.done) break;
            yield part.value;
          }
        })(),
      );
      const gzip = prefix[0] === 0x1f && prefix[1] === 0x8b;
      const zstd = prefix.subarray(0, 4).equals(Buffer.from([0x28, 0xb5, 0x2f, 0xfd]));
      if (zstd) throw new Error('IMAGE_COMPRESSION_UNSUPPORTED_ZSTD');
      const layer = header.name.endsWith('.tar') || gzip;
      const decoded = gzip ? input.pipe(createGunzip()) : input;
      const scan = secretScanner(values);
      let initial = Buffer.alloc(0);
      for await (const part of decoded) {
        const bytes = Buffer.from(part);
        decodedBytes += bytes.length;
        if (decodedBytes > 4 * 1024 ** 3) throw new Error('IMAGE_DECODED_BOUND');
        if (initial.length < 512) initial = Buffer.concat([initial, bytes]).subarray(0, 512);
        scan(bytes);
      }
      if (layer) {
        if (
          initial.length < 512 ||
          (initial.subarray(257, 262).toString() !== 'ustar' && !initial.every(byte => byte === 0))
        )
          throw new Error('IMAGE_LAYER_FORMAT_UNSUPPORTED');
        const kind = gzip ? 'gzip-tar' : 'tar';
        formats[kind] = (formats[kind] ?? 0) + 1;
      } else if (header.name.startsWith('blobs/')) {
        const first = initial.toString().trimStart()[0];
        if (first === '{' || first === '[') formats.json = (formats.json ?? 0) + 1;
        else if (initial.subarray(257, 262).toString() === 'ustar' || initial.every(byte => byte === 0))
          formats.tar = (formats.tar ?? 0) + 1;
        else throw new Error('IMAGE_BLOB_FORMAT_UNSUPPORTED');
      }
      next();
    })().catch(error => fail(error instanceof Error ? error : new Error('IMAGE_AUDIT_FAILED')));
  });
  stream.on('data', (chunk: Buffer) => {
    archiveBytes += chunk.length;
    if (archiveBytes > 2 * 1024 ** 3) fail(new Error('IMAGE_ARCHIVE_BOUND'));
  });
  try {
    stream.pipe(parser);
    await completed;
    if (!(formats.tar || formats['gzip-tar'])) throw new Error('IMAGE_LAYERS_NOT_OBSERVED');
    return { archiveBytes, decodedBytes, files, formats };
  } finally {
    clearTimeout(timer);
    stream.destroy();
    parser.destroy();
  }
}
/** Exercise the image audit against a compressed layer containing a controlled marker. */
export async function compressedLayerCanary() {
  const value = 'OWNED_IMAGE_SECRET_CANARY_f3af4d9f';
  const layer = pack();
  layer.entry({ name: 'private-canary', size: Buffer.byteLength(value) }, value);
  layer.finalize();
  const parts: Buffer[] = [];
  for await (const part of layer) {
    if (!Buffer.isBuffer(part)) throw new Error('IMAGE_CHUNK_INVALID');
    parts.push(part);
  }
  const compressed = gzipSync(Buffer.concat(parts));
  const archive = pack();
  archive.entry({ name: 'blobs/sha256/controlled-gzip-layer', size: compressed.length }, compressed);
  archive.finalize();
  await expect(auditImageArchive(archive as unknown as Readable, [value])).rejects.toThrow('PROHIBITED_IMAGE_CONTENT');
}
