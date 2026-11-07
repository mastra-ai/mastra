import { StringDecoder } from 'node:string_decoder';
import type Docker from 'dockerode';
import type { Duplex } from 'node:stream';
import type { PrivateSandbox } from './native.js';
import type { KatanaCommand, RestCommand } from './command.js';

// This is a provider-specific pipe control, not a second sandbox. DockerSandbox
// still owns start, inspected isolation, safe control commands, and destroy.
/** Run an owned sandbox command with bounded private pipes and explicit cancellation cleanup. */
export async function privateProcess(
  sandbox: PrivateSandbox,
  command: KatanaCommand | RestCommand,
  options: {
    abortSignal?: AbortSignal;
    timeout: number;
    totalLimit?: number;
    onStdout: (chunk: string) => void;
    onStderr: (chunk: string) => void;
  },
) {
  const { executable, args } = command;
  const boundary = sandbox.boundaryEvidence;
  if (!boundary || boundary.logDriver !== 'none') throw new Error('PRIVATE_EXEC_BOUNDARY_REQUIRED');
  options.abortSignal?.throwIfAborted();
  const limit = options.totalLimit ?? 262144;
  if (!Number.isInteger(limit) || limit < 1024 || limit > 262144) throw new Error('PRIVATE_EXEC_LIMIT');
  let execution: Docker.Exec | undefined;
  let stream: Duplex | undefined;
  let wakeRead: (() => void) | undefined;
  let ended = false;
  const decoders = { stdout: new StringDecoder('utf8'), stderr: new StringDecoder('utf8') };
  let stopReason: string | undefined;
  let killPromise: Promise<void> | undefined;
  let accepted = 0,
    frames = 0,
    maximumBuffered = 0,
    discardedSocketBytes = 0;
  const started = Date.now();
  /** Kill the container only after its identity and ownership still match the recorded boundary. */
  const killOwned = async () => {
    const inspection = await sandbox.container.inspect();
    if (
      inspection.Id !== boundary.containerId ||
      inspection.Image !== boundary.imageId ||
      inspection.Config.Labels['mastra.sandbox.id'] !== sandbox.id
    )
      throw new Error('PRIVATE_KILL_OWNERSHIP');
    if (inspection.State.Running) {
      await sandbox.container.kill({ signal: 'SIGKILL' });
      await sandbox.container.wait();
    }
  };
  /** Set the first private-process stop reason and discard buffered socket output before termination. */
  const stop = (reason: string) => {
    if (stopReason) return;
    stopReason = reason;
    discardedSocketBytes = stream?.readableLength ?? 0;
    stream?.pause();
    stream?.destroy();
    wakeRead?.();
    killPromise = killOwned();
  };
  const deadline = new AbortController();
  const signal = AbortSignal.any([deadline.signal, ...(options.abortSignal ? [options.abortSignal] : [])]);
  /** Translate deadline expiry or caller cancellation into the private-process stop reason. */
  const abort = () => stop(deadline.signal.aborted ? 'command-timeout' : 'driver-cancelled');
  signal.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => deadline.abort(), options.timeout ?? 45000);
  const streamError = () => stop('stream-error');
  /** Read an exact bounded private frame or stop on stream termination, cancellation or timeout. */
  const read = async (length: number): Promise<Buffer | null> => {
    while (!stopReason) {
      // Legacy provider streams may report readable repeatedly without satisfying
      // an exact-sized read. Yield a macrotask so deadline/cancellation can run.
      await new Promise<void>(resolve => setImmediate(resolve));
      if (stopReason) return null;
      if (!stream) throw new Error('PRIVATE_STREAM_REQUIRED');
      maximumBuffered = Math.max(maximumBuffered, stream.readableLength ?? 0);
      const bytes = stream.read(length);
      if (bytes !== null) return bytes;
      if (ended || stream.destroyed || stream.readableEnded) return null;
      await new Promise<void>(resolve => {
        const activeStream = stream!;
        const finish = () => {
          activeStream.removeListener('readable', finish);
          wakeRead = undefined;
          resolve();
        };
        wakeRead = finish;
        activeStream.once('readable', finish);
        if (stopReason || ended) finish();
      });
    }
    return null;
  };
  try {
    execution = await sandbox.container.exec({
      Cmd: [executable, ...args],
      User: '10001:10001',
      WorkingDir: '/workspace',
      Env: ['TMPDIR=/workspace/private-tmp'],
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
      abortSignal: signal,
    });
    stream = await execution.start({ hijack: true, stdin: false, abortSignal: signal });
    stream.on('error', streamError);
    for (const event of ['end', 'close'])
      stream.on(event, () => {
        ended = true;
        wakeRead?.();
      });
    stream.pause();
    while (!stopReason) {
      const header = await read(8);
      if (!header) break;
      if (header.length !== 8 || ![1, 2].includes(header[0] ?? 0) || header[1] || header[2] || header[3]) {
        stop('frame-header');
        break;
      }
      let remaining = header.readUInt32BE(4);
      if (remaining > 1048576) {
        stop('frame-bound');
        break;
      }
      frames++;
      if (frames > 4096) {
        stop('frame-count');
        break;
      }
      const channel = header[0] === 1 ? 'stdout' : 'stderr';
      while (remaining > 0 && !stopReason) {
        const size = Math.min(remaining, 4096, limit - accepted);
        if (size <= 0) {
          stop('total-output-limit');
          break;
        }
        const chunk = await read(size);
        if (!chunk || chunk.length !== size) {
          stop('frame-truncated');
          break;
        }
        accepted += chunk.length;
        remaining -= chunk.length;
        const text = decoders[channel].write(chunk);
        if (text) {
          if (channel === 'stdout') options.onStdout?.(text);
          else options.onStderr?.(text);
        }
        if (accepted === limit) stop('total-output-limit');
      }
    }
    if (!stopReason) {
      for (const channel of ['stdout', 'stderr'] as const) {
        const tail = decoders[channel].end();
        if (tail) {
          if (channel === 'stdout') options.onStdout?.(tail);
          else options.onStderr?.(tail);
        }
      }
    }
    if (killPromise) await killPromise;
    let inspection = await execution.inspect();
    for (let attempt = 0; inspection.Running && attempt < 40; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 25));
      inspection = await execution.inspect();
    }
    if (inspection.Running) {
      stop('exit-not-observed');
      await killPromise;
      inspection = await execution.inspect();
    }
    return {
      success: !stopReason && inspection.ExitCode === 0,
      exitCode: inspection.ExitCode,
      killed: Boolean(stopReason),
      timedOut: stopReason === 'command-timeout',
      stdout: '',
      stderr: '',
      stdoutTruncated: Boolean(stopReason),
      stderrTruncated: Boolean(stopReason),
      pipe: {
        method: 'public DockerSandbox container exec, pull-based Docker frame reader',
        acceptedPayloadBytes: accepted,
        totalLimit: limit,
        maximumSocketBufferedBytes: maximumBuffered,
        socketHighWaterMark: stream?.readableHighWaterMark,
        discardedSocketBytesAtStop: discardedSocketBytes,
        frames,
        stopReason,
        elapsedMs: Date.now() - started,
        kernelInFlightBytes: 'not measured; bounded transport prebuffer is distinct from admitted payload',
      },
    };
  } catch {
    stop('consumer-or-provider-failure');
    if (killPromise) await killPromise;
    const observed = execution ? await execution.inspect().catch(() => undefined) : undefined;
    return {
      success: false,
      exitCode: observed && !observed.Running ? observed.ExitCode : null,
      killed: true,
      timedOut: stopReason === 'command-timeout',
      stdout: '',
      stderr: '',
      stdoutTruncated: true,
      stderrTruncated: true,
      pipe: {
        acceptedPayloadBytes: accepted,
        totalLimit: limit,
        maximumSocketBufferedBytes: maximumBuffered,
        discardedSocketBytesAtStop: discardedSocketBytes,
        frames,
        stopReason,
        elapsedMs: Date.now() - started,
      },
    };
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
    stream?.destroy();
  }
}
