import { fromChunk, normalise } from './normalise';
import type { RawFrame } from './normalise';
import type { Frame } from './types';

/**
 * Reads a run through the real server route `POST /api/agents/:agentId/observe`
 * (SSE), the way a browser reconnecting to a run does. The route closes on
 * finish, error and abort; anything else ends at `timeoutMs` with a
 * `(timeout)` frame.
 */
export async function httpObserve(port: number, agentId: string, runId: string, timeoutMs = 5_000): Promise<Frame[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const raw: RawFrame[] = [];
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/agents/${agentId}/observe`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ runId }),
      signal: controller.signal,
    });
    if (res.status !== 200) return [{ type: `(http ${res.status})`, shape: await res.text() }];
    const decoder = new TextDecoder();
    let buffer = '';
    for await (const bytes of res.body as any as AsyncIterable<Uint8Array>) {
      buffer += decoder.decode(bytes, { stream: true });
      let end: number;
      while ((end = buffer.indexOf('\n\n')) >= 0) {
        const record = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const data = record
          .split('\n')
          .filter(line => line.startsWith('data:'))
          .map(line => line.slice(5).trimStart())
          .join('\n');
        if (!data || data === '[DONE]') continue;
        raw.push(fromChunk(JSON.parse(data)));
      }
    }
  } catch (error) {
    raw.push(controller.signal.aborted ? { type: '(timeout)' } : { type: '(threw)', payload: { error } });
  } finally {
    clearTimeout(timer);
  }
  return normalise(raw);
}
