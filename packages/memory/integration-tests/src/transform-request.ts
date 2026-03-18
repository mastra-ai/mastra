import * as crypto from 'node:crypto';

// Debug flag - set to true to enable verbose logging
const DEBUG_HASH = true;

function stableSortKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(stableSortKeys);
  } else if (obj !== null && typeof obj === 'object') {
    const sortedKeys = Object.keys(obj as Record<string, unknown>).sort();
    const result: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      result[key] = stableSortKeys((obj as Record<string, unknown>)[key]);
    }
    return result;
  }
  return obj;
}

function computeHash(url: string, body: unknown): string {
  const normalizedBody = JSON.stringify(stableSortKeys(body));
  const content = `${url}:${normalizedBody}`;
  return crypto.createHash('md5').update(content).digest('hex').slice(0, 16);
}

export function transformRequest({ url, body }: { url: string; body: unknown }): { url: string; body: unknown } {
  let stringifiedBody = JSON.stringify(body);
  // Normalize dynamic fields that change between test runs
  // These regexes match JSON property patterns like "id":"value" in stringified JSON
  stringifiedBody = stringifiedBody.replaceAll(/"createdAt":"[^"]+"/g, '"createdAt":"REDACTED"');
  stringifiedBody = stringifiedBody.replaceAll(/"toolCallId":"[^"]+"/g, '"toolCallId":"REDACTED"');
  stringifiedBody = stringifiedBody.replaceAll(/"id":"[^"]+"/g, '"id":"REDACTED"');
  stringifiedBody = stringifiedBody.replaceAll(/\d+ms/g, 'REDACTED');
  // Google Gemini includes thoughtSignature which is session-specific
  stringifiedBody = stringifiedBody.replaceAll(/"thoughtSignature":"[^"]+"/g, '"thoughtSignature":"REDACTED"');
  // Tool outputs may contain stringified JSON with escaped quotes containing dynamic IDs like doc-TIMESTAMP
  // Example: "output": "{\"id\":\"doc-1773860673929\",\"status\":\"created\"}"
  stringifiedBody = stringifiedBody.replaceAll(/\\\"id\\\":\\\"[^\\]+\\\"/g, '\\"id\\":\\"REDACTED\\"');

  const transformedBody = JSON.parse(stringifiedBody);

  // Debug logging for all providers
  if (DEBUG_HASH) {
    const hash = computeHash(url, transformedBody);
    const bodyObj = transformedBody as Record<string, unknown>;

    let provider = 'Unknown';
    let messageCount = 0;

    if (url.includes('generativelanguage.googleapis.com')) {
      provider = 'Gemini';
      const contents = bodyObj.contents as Array<unknown> | undefined;
      messageCount = contents?.length ?? 0;
    } else if (url.includes('openai.com')) {
      provider = 'OpenAI';
      const input = bodyObj.input as Array<unknown> | undefined;
      messageCount = input?.length ?? 0;
    } else if (url.includes('anthropic.com')) {
      provider = 'Anthropic';
      const messages = bodyObj.messages as Array<unknown> | undefined;
      messageCount = messages?.length ?? 0;
    }

    if (provider !== 'Unknown') {
      console.error(`[DEBUG-HASH] ${provider}: hash=${hash}, messages=${messageCount}`);
    }
  }

  return {
    url,
    body: transformedBody,
  };
}
