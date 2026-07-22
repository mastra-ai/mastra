function replaceField(stringifiedBody: string, field: string, replacement: string) {
  let str = stringifiedBody;
  str = str.replaceAll(new RegExp(`"${field}":("[^"]+"|-?\\d+(?:\\.\\d+)?)`, 'g'), `"${field}":"${replacement}"`);
  str = str.replaceAll(
    new RegExp(`\\\\"${field}\\\\":(\\\\"[^"]+\\\\"|-?\\d+(?:\\.\\d+)?)`, 'g'),
    `\\"${field}\\":\\"${replacement}\\"`,
  );

  return str;
}

function normalizeOpenAIResponseFunctionCalls(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeOpenAIResponseFunctionCalls);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const object = value as Record<string, unknown>;
  if (object.type === 'function_call') {
    return { type: 'item_reference', id: 'REDACTED' };
  }

  return Object.fromEntries(
    Object.entries(object).map(([key, entry]) => [key, normalizeOpenAIResponseFunctionCalls(entry)]),
  );
}

function normalizeNetworkFinalResultMessages(value: unknown): unknown {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      const normalized = normalizeNetworkFinalResultMessages(parsed);
      return normalized === parsed ? value : JSON.stringify(normalized);
    } catch {
      return value;
    }
  }

  if (Array.isArray(value)) {
    return value.map(normalizeNetworkFinalResultMessages);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const object = value as Record<string, unknown>;
  let changed = false;
  const normalizedEntries = Object.entries(object).map(([key, entry]) => {
    const normalized = normalizeNetworkFinalResultMessages(entry);
    if (normalized !== entry) changed = true;
    return [key, normalized] as const;
  });

  const normalizedObject = Object.fromEntries(normalizedEntries) as Record<string, unknown>;
  const finalResult = normalizedObject.finalResult;
  if (
    finalResult &&
    typeof finalResult === 'object' &&
    Array.isArray((finalResult as { messages?: unknown }).messages)
  ) {
    const result = finalResult as { messages: Array<{ createdAt?: string }> };
    result.messages = [...result.messages].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return aTime - bTime;
    });
    changed = true;
  }

  return changed ? normalizedObject : value;
}

// OpenRouter's AI SDK provider v2 sends message content as an array of text
// parts where v1 sent a plain string. Collapse all-text content arrays back to
// strings so recordings stay compatible across SDK versions.
function normalizeOpenRouterTextContent(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeOpenRouterTextContent);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const object = Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      normalizeOpenRouterTextContent(entry),
    ]),
  );

  if (
    typeof object.role === 'string' &&
    Array.isArray(object.content) &&
    object.content.length > 0 &&
    object.content.every(
      part =>
        part &&
        typeof part === 'object' &&
        (part as { type?: unknown }).type === 'text' &&
        typeof (part as { text?: unknown }).text === 'string',
    )
  ) {
    object.content = (object.content as Array<{ text: string }>).map(part => part.text).join('');
  }

  return object;
}

export function transformRequest({ url, body }: { url: string; body: unknown }): { url: string; body: unknown } {
  let normalizedBody = normalizeOpenAIResponseFunctionCalls(normalizeNetworkFinalResultMessages(body));
  if (url.includes('openrouter.ai')) {
    normalizedBody = normalizeOpenRouterTextContent(normalizedBody);
  }
  let stringifiedBody = JSON.stringify(normalizedBody);

  // Normalize dynamic fields that change between test runs
  // These regexes match JSON property patterns like "id":"value" in stringified JSON
  stringifiedBody = replaceField(stringifiedBody, 'createdAt', 'REDACTED');
  stringifiedBody = replaceField(stringifiedBody, 'toolCallId', 'REDACTED');
  stringifiedBody = replaceField(stringifiedBody, 'tool_call_id', 'REDACTED');
  stringifiedBody = replaceField(stringifiedBody, 'call_id', 'REDACTED');
  stringifiedBody = replaceField(stringifiedBody, 'id', 'REDACTED');
  stringifiedBody = stringifiedBody.replaceAll(/\d+ms/g, 'REDACTED');
  // Google Gemini includes thoughtSignature which is session-specific
  stringifiedBody = replaceField(stringifiedBody, 'thoughtSignature', 'REDACTED');
  // OpenAI tool definitions may include "strict": false/true which varies by SDK version
  // Replace the property but preserve valid JSON structure
  stringifiedBody = stringifiedBody.replaceAll(/"strict":(true|false),/g, '');
  stringifiedBody = stringifiedBody.replaceAll(/,"strict":(true|false)/g, '');
  // Anthropic tool definitions may include eager_input_streaming depending on SDK version
  stringifiedBody = stringifiedBody.replaceAll(/"eager_input_streaming":(true|false),/g, '');
  stringifiedBody = stringifiedBody.replaceAll(/,"eager_input_streaming":(true|false)/g, '');
  // Normalize dates/timestamps in remembered messages (timezone/date differences cause hash mismatches)
  stringifiedBody = stringifiedBody.replaceAll(/\d{4},\s*\w{3},\s*\d{1,2}/g, 'REDACTED_DATE');
  stringifiedBody = stringifiedBody.replaceAll(/\d{1,2}:\d{2}\s*(AM|PM)/gi, 'REDACTED_TIME');
  // Remove "caller" objects that may be present in some SDK versions
  // Handle both cases: with trailing comma and as last property
  stringifiedBody = stringifiedBody.replaceAll(/"caller":\s*\{\s*"type":\s*"[^"]+"\s*\},/g, '');
  stringifiedBody = stringifiedBody.replaceAll(/,"caller":\s*\{\s*"type":\s*"[^"]+"\s*\}/g, '');

  return {
    url,
    body: JSON.parse(stringifiedBody),
  };
}
