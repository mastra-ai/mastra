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

  // Debug logging for Gemini requests only
  if (DEBUG_HASH && url.includes('generativelanguage.googleapis.com')) {
    const hash = computeHash(url, transformedBody);
    const bodyObj = transformedBody as Record<string, unknown>;
    const contents = bodyObj.contents as Array<Record<string, unknown>> | undefined;
    console.error(`[DEBUG-HASH] Gemini request:`);
    console.error(`[DEBUG-HASH]   URL: ${url}`);
    console.error(`[DEBUG-HASH]   Hash: ${hash}`);
    console.error(`[DEBUG-HASH]   Contents count: ${contents?.length ?? 'N/A'}`);
    console.error(`[DEBUG-HASH]   Body keys: ${Object.keys(bodyObj).sort().join(', ')}`);
    if (contents && contents.length > 0) {
      const firstContent = contents[0];
      console.error(`[DEBUG-HASH]   First content role: ${firstContent.role}`);
      const parts = firstContent.parts as Array<Record<string, unknown>> | undefined;
      if (parts && parts.length > 0) {
        const firstPart = parts[0];
        const text = firstPart.text as string | undefined;
        console.error(`[DEBUG-HASH]   First content text: ${text?.slice(0, 80) ?? 'N/A'}...`);
      }
    }
    // Log first 500 chars of normalized body for comparison
    const normalizedForLog = JSON.stringify(stableSortKeys(transformedBody));
    console.error(`[DEBUG-HASH]   Normalized body (first 500): ${normalizedForLog.slice(0, 500)}`);
  }

  return {
    url,
    body: transformedBody,
  };
}
