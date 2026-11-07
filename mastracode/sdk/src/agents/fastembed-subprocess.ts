import { spawn } from 'node:child_process';
import type { fastembed } from '@mastra/fastembed';

type FastembedModel = typeof fastembed.small;
type DoEmbedOptions = Parameters<FastembedModel['doEmbed']>[0];
type DoEmbedResult = Awaited<ReturnType<FastembedModel['doEmbed']>>;
type WorkerReply = { embeddings?: number[][]; warnings?: DoEmbedResult['warnings']; error?: string };

/**
 * Run with `node -e`. Loads `@mastra/fastembed` from the given entry, embeds once, replies over IPC and
 * exits, so ONNX Runtime's session and memory arena leave with the process. It raises its own OOM score
 * first: if a small sandbox runs out of memory mid-embedding, the kernel kills this worker, not the agent.
 */
const WORKER_SOURCE = `
try { require('node:fs').writeFileSync('/proc/self/oom_score_adj', '500'); } catch {}
process.once('message', async ({ entry, values }) => {
  try {
    const mod = await import(entry);
    const { embeddings, warnings } = await (mod.fastembed ?? mod.default.fastembed).small.doEmbed({ values });
    process.send({ embeddings, warnings }, () => process.exit(0));
  } catch (error) {
    process.send({ error: String((error && error.stack) || error) }, () => process.exit(1));
  }
});
`;

let queue: Promise<unknown> = Promise.resolve();

/**
 * Embeds with `fastembed.small` in a short-lived child process, one call at a time.
 *
 * In-process, the bge-small session costs ~230 MB of RSS that stays for the rest of the run (plus ~33 MB
 * of arena per extra text in a batch, also kept). In a 4 GB sandbox that makes the agent the largest
 * process, which is the one the kernel OOM killer picks. Observational memory embeds a few times per run,
 * so the ~0.3 s model load per call is cheap.
 */
export function embedInSubprocess(
  options: DoEmbedOptions,
  entry: string = import.meta.resolve('@mastra/fastembed'),
): Promise<DoEmbedResult> {
  const run = () => runWorker(entry, options);
  const result = queue.then(run, run);
  queue = result.catch(() => {});
  return result;
}

function runWorker(entry: string, { values, abortSignal }: DoEmbedOptions): Promise<DoEmbedResult> {
  return new Promise((resolve, reject) => {
    if (abortSignal?.aborted) {
      reject(abortSignal.reason);
      return;
    }
    const child = spawn(process.execPath, ['-e', WORKER_SOURCE], {
      stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
      env: process.env,
    });
    let reply: WorkerReply | undefined;
    const onAbort = () => child.kill('SIGKILL');
    abortSignal?.addEventListener('abort', onAbort, { once: true });
    child.on('message', message => {
      reply = message as WorkerReply;
    });
    child.once('error', error => {
      abortSignal?.removeEventListener('abort', onAbort);
      reject(error);
    });
    // 'close' follows the IPC channel closing, so a reply sent before exit has arrived by then.
    child.once('close', (code, signal) => {
      abortSignal?.removeEventListener('abort', onAbort);
      if (reply?.embeddings) {
        resolve({ embeddings: reply.embeddings, warnings: reply.warnings ?? [] });
      } else if (abortSignal?.aborted) {
        reject(abortSignal.reason);
      } else {
        reject(new Error(reply?.error ?? `fastembed worker exited without a result (code ${code}, signal ${signal})`));
      }
    });
    child.send({ entry, values });
  });
}
