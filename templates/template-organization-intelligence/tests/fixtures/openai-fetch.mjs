import { appendFile } from 'node:fs/promises';

const mode = process.env.EVALUATION_FIXTURE_MODE;
const log = process.env.EVALUATION_FIXTURE_LOG;
const record = value => appendFile(log, JSON.stringify(value) + '\n');
if (mode === 'timeout') {
  const timeout = AbortSignal.timeout.bind(AbortSignal);
  AbortSignal.timeout = () => timeout(1);
}
globalThis.fetch = async (input, init = {}) => {
  const url = String(input);
  const body = init.body ? JSON.parse(String(init.body)) : {};
  const request = { body, path: new URL(url).pathname };
  if (mode === 'timeout' && request.path.endsWith('/embeddings')) {
    await new Promise((resolve, reject) => {
      const signal = init.signal;
      if (!signal) return reject(new Error('fixture request was not abortable'));
      const abort = async () => {
        clearTimeout(fallback);
        await record({ ...request, aborted: true });
        reject(signal.reason);
      };
      const fallback = setTimeout(() => reject(new Error('fixture request did not abort')), 50);
      if (signal.aborted) void abort();
      else signal.addEventListener('abort', () => void abort(), { once: true });
    });
  }
  await record(request);
  if (request.path.endsWith('/embeddings')) {
    return new Response(
      JSON.stringify({ data: [{ embedding: Array.from({ length: 1536 }, () => 0.01) }], usage: { total_tokens: 3 } }),
      { headers: { 'content-type': 'application/json' }, status: 200 },
    );
  }
  if (mode === 'expired') return new Response('expired', { status: 401 });
  const judge = JSON.stringify(body).includes('Judge synthetic evaluation only.');
  if ((mode === 'retryable-answer' && !judge) || (mode === 'retryable-judge' && judge))
    return new Response('retry later', { status: 503 });
  const content = judge
    ? JSON.stringify({ supportedClaims: 0, totalClaims: 1, supportedFactIds: [], unauthorizedBehavior: false })
    : JSON.stringify({ status: 'insufficient_evidence', answer: 'The records do not establish this.', citations: [] });
  if (request.path.endsWith('/responses')) {
    return new Response(
      JSON.stringify({
        created_at: 0,
        id: 'fixture-response',
        model: 'fixture-model',
        object: 'response',
        output: [
          {
            content: [{ annotations: [], text: content, type: 'output_text' }],
            id: 'fixture-message',
            role: 'assistant',
            status: 'completed',
            type: 'message',
          },
        ],
        status: 'completed',
        usage: { input_tokens: 3, output_tokens: 4, total_tokens: 7 },
      }),
      { headers: { 'content-type': 'application/json' }, status: 200 },
    );
  }
  return new Response(
    JSON.stringify({
      choices: [{ finish_reason: 'stop', index: 0, message: { content, role: 'assistant' } }],
      created: 0,
      id: 'fixture-response',
      model: 'fixture-model',
      object: 'chat.completion',
      usage: { completion_tokens: 4, prompt_tokens: 3, total_tokens: 7 },
    }),
    { headers: { 'content-type': 'application/json' }, status: 200 },
  );
};
