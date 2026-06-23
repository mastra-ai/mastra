import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createGlobalPatchScope } from './global-patches.js';

export type OpenAIFetchCaptureOptions = {
  capturePath: string;
  append?: boolean;
  inputTokens?: number;
  requireBodyIncludes?: Array<string | { value: string; label?: string }>;
};

function getFetchUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

async function getBodyText(
  body: BodyInit | null | undefined,
): Promise<{ bodyText?: string; nextBody?: BodyInit | null }> {
  if (!body) return {};
  if (typeof body === 'string') return { bodyText: body, nextBody: body };
  if (body instanceof Uint8Array) {
    const bodyText = new TextDecoder().decode(body);
    return { bodyText, nextBody: body };
  }
  if (typeof body === 'object' && 'text' in body && typeof body.text === 'function') {
    const bodyText = await (body as { text: () => Promise<string> }).text();
    return { bodyText, nextBody: bodyText };
  }
  return { nextBody: body };
}

export function installOpenAIFetchCapture(options: OpenAIFetchCaptureOptions): () => void {
  mkdirSync(dirname(options.capturePath), { recursive: true });
  const patches = createGlobalPatchScope();
  const originalFetch = globalThis.fetch.bind(globalThis);

  patches.setProperty(globalThis, 'fetch', async (input, init) => {
    const url = getFetchUrl(input);

    if (options.inputTokens !== undefined && url.includes('/v1/responses/input_tokens')) {
      if (init?.body) {
        const { bodyText } = await getBodyText(init.body);
        if (bodyText) appendFileSync(options.capturePath, `${JSON.stringify({ url, body: bodyText })}\n`);
      }
      return new Response(JSON.stringify({ input_tokens: options.inputTokens }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.includes('/v1/responses') && init?.body) {
      const { bodyText, nextBody } = await getBodyText(init.body);
      if (bodyText) {
        if (options.append) appendFileSync(options.capturePath, `${JSON.stringify({ url, body: bodyText })}\n`);
        else writeFileSync(options.capturePath, bodyText);

        for (const required of options.requireBodyIncludes ?? []) {
          const value = typeof required === 'string' ? required : required.value;
          const label = typeof required === 'string' ? required : (required.label ?? required.value);
          if (!bodyText.includes(value)) {
            throw new Error(`Expected OpenAI request body to include ${label}`);
          }
        }
      }
      return originalFetch(input, { ...init, body: nextBody });
    }

    return originalFetch(input, init);
  });

  return () => patches.restore();
}
