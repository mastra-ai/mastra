import type Docker from 'dockerode';
import type { Readable } from 'node:stream';
import { pack, extract } from 'tar-stream';
import { setTimeout as pause } from 'node:timers/promises';

/** Stage bounded private runtime files inside the owned sandbox. */
export async function stageFiles(
  container: Docker.Container,
  files: Record<string, { bytes: Buffer; mode?: number }>,
  root = false,
  signal?: AbortSignal,
) {
  const archive = pack();
  if (root) archive.entry({ name: 'workspace', type: 'directory', mode: 0o700, uid: 10001, gid: 10001 });
  for (const [name, file] of Object.entries(files)) {
    if (!/^[a-zA-Z0-9_.-]+$/.test(name) || file.bytes.length > 8 * 1024 * 1024) throw new Error('PRIVATE_FILE_BOUND');
    archive.entry(
      {
        name: root ? `workspace/${name}` : name,
        mode: file.mode ?? 0o600,
        uid: 10001,
        gid: 10001,
        size: file.bytes.length,
      },
      file.bytes,
    );
  }
  archive.finalize();
  try {
    await container.putArchive(archive as unknown as NodeJS.ReadableStream, {
      path: root ? '/' : '/workspace',
      copyUIDGID: true,
      abortSignal: signal,
    });
  } finally {
    archive.destroy();
    for (const file of Object.values(files)) file.bytes.fill(0);
  }
}
/** Read a bounded sandbox file without enabling retained native command output. */
export async function readRuntimeFile(
  container: Docker.Container,
  path: '/workspace/gateway-stats.json' | '/workspace/ca/mitmproxy-ca-cert.pem' | '/workspace/lab-root.pem',
) {
  const stream = (await container.getArchive({ path })) as Readable,
    parser = extract();
  let bytes = Buffer.alloc(0),
    files = 0;
  parser.on('entry', (header, entry, next) => {
    entry.on('data', (chunk: unknown) => {
      if (!Buffer.isBuffer(chunk) || header.type !== 'file') return;
      bytes = Buffer.concat([bytes, chunk]);
      if (bytes.length > 65536) parser.destroy(new Error('RUNTIME_FILE_BOUND'));
    });
    entry.on('end', () => {
      if (header.type === 'file') files++;
      next();
    });
  });
  const completed = new Promise<void>((resolve, reject) => {
    parser.once('finish', resolve);
    parser.once('error', reject);
    stream.once('error', () => reject(new Error('RUNTIME_FILE_READ')));
  });
  const timer = setTimeout(() => {
    parser.destroy(new Error('RUNTIME_FILE_TIMEOUT'));
    stream.destroy();
  }, 5000);
  try {
    stream.pipe(parser);
    await completed;
    if (files !== 1) throw new Error('RUNTIME_FILE_INVALID');
    return bytes;
  } finally {
    clearTimeout(timer);
    stream.destroy();
    parser.destroy();
  }
}
// Only fixed diagnostic commands call this helper. It never receives Katana or
// a credential-bearing command; discovery uses the private pull pipe instead.
/** Send a typed gateway control operation and validate its bounded response. */
export async function control(container: Docker.Container, args: string[], timeout = 5000, signal?: AbortSignal) {
  const joined = AbortSignal.any([AbortSignal.timeout(timeout), ...(signal ? [signal] : [])]);
  const execution = await container.exec({
    Cmd: args,
    AttachStdout: true,
    AttachStderr: true,
    Tty: false,
    abortSignal: joined,
  });
  const stream = await execution.start({ hijack: true, stdin: false, abortSignal: joined });
  stream.pause();
  let ended = false,
    failed = false,
    frames = Buffer.alloc(0),
    stdout = '',
    stderr = '',
    total = 0;
  stream.on('error', () => {
    failed = true;
  });
  stream.on('end', () => {
    ended = true;
  });
  try {
    while (!ended || stream.readableLength) {
      joined.throwIfAborted();
      if (failed) throw new Error('CONTROL_STREAM_FAILED');
      const chunk: Buffer | null = stream.read();
      if (!chunk) {
        await pause(5, undefined, { signal: joined });
        continue;
      }
      total += chunk.length;
      if (total > 65536) throw new Error('CONTROL_OUTPUT_BOUND');
      frames = Buffer.concat([frames, chunk]);
      while (frames.length >= 8) {
        const channel = frames[0],
          length = frames.readUInt32BE(4);
        if (length > 65536 || ![1, 2].includes(channel ?? 0) || frames[1] || frames[2] || frames[3])
          throw new Error('CONTROL_FRAME');
        if (frames.length < 8 + length) break;
        const text = frames.subarray(8, 8 + length).toString();
        if (channel === 1) stdout += text;
        else stderr += text;
        frames = frames.subarray(8 + length);
      }
    }
    if (frames.length) throw new Error('CONTROL_FRAME_TRUNCATED');
    let state = await execution.inspect();
    while (state.Running) {
      joined.throwIfAborted();
      await pause(10, undefined, { signal: joined });
      state = await execution.inspect();
    }
    return { success: state.ExitCode === 0, stdout, stderr };
  } finally {
    stream.destroy();
  }
}
