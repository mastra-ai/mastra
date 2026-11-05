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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// Google provider versions disagree on whether text emitted before a tool call
// belongs beside that call or after its response. Use the current combined form
// so old recordings and current requests hash to the same value.
function normalizeGoogleToolCallMessages(body: unknown): unknown {
  if (!isRecord(body) || !Array.isArray(body.contents)) {
    return body;
  }

  const contents = body.contents.map(content => {
    if (!isRecord(content) || !Array.isArray(content.parts)) {
      return content;
    }

    const parts = content.parts.map(part => {
      if (!isRecord(part)) {
        return part;
      }

      const normalizedPart = { ...part };
      for (const key of ['functionCall', 'functionResponse']) {
        if (isRecord(normalizedPart[key])) {
          const functionValue = { ...normalizedPart[key] };
          delete functionValue.id;
          normalizedPart[key] = functionValue;
        }
      }
      return normalizedPart;
    });

    return { ...content, parts };
  });

  for (let index = 0; index < contents.length - 2; index++) {
    const call = contents[index];
    const response = contents[index + 1];
    const trailingText = contents[index + 2];
    if (
      !isRecord(call) ||
      call.role !== 'model' ||
      !Array.isArray(call.parts) ||
      !call.parts.some(part => isRecord(part) && isRecord(part.functionCall)) ||
      call.parts.some(part => isRecord(part) && typeof part.text === 'string') ||
      !isRecord(response) ||
      response.role !== 'user' ||
      !Array.isArray(response.parts) ||
      !response.parts.some(part => isRecord(part) && isRecord(part.functionResponse)) ||
      !isRecord(trailingText) ||
      trailingText.role !== 'model' ||
      !Array.isArray(trailingText.parts) ||
      trailingText.parts.length === 0 ||
      !trailingText.parts.every(part => isRecord(part) && typeof part.text === 'string')
    ) {
      continue;
    }

    contents[index] = { ...call, parts: [...trailingText.parts, ...call.parts] };
    contents.splice(index + 2, 1);
  }

  return { ...body, contents };
}

function normalizeObservationHeadings(text: string): string {
  return text
    .replaceAll(
      /^Date: (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}, \d{4}(?: \((?:today|yesterday|\d+ (?:day|week|month|year)s? ago)\))?$/gm,
      'Date: REDACTED_DATE',
    )
    .replaceAll(/^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2} \d{4}:$/gm, 'REDACTED_DATE:');
}

function normalizeObserverRequest(content: unknown): unknown {
  if (!Array.isArray(content)) return content;
  const historyIndex = content.findIndex(
    part => isRecord(part) && part.text === '## New Message History to Observe\n\n',
  );
  const task = content.at(-1);
  if (
    historyIndex < 0 ||
    !isRecord(task) ||
    typeof task.text !== 'string' ||
    !task.text.startsWith('\n\n---\n\n## Your Task\n\n')
  ) {
    return content;
  }
  return content.map((part, index) => {
    if (!isRecord(part) || typeof part.text !== 'string') return part;
    let text = part.text;
    if (index < historyIndex) {
      text = text.replace(
        /^(## Previous Observations\n\n)([\s\S]*?)(?=\n\n---\n\n)/,
        (_, heading, observations) => heading + normalizeObservationHeadings(observations),
      );
    } else if (index > historyIndex && index < content.length - 1) {
      // formatObserverLines puts the generated date first; user continuations below it are raw text.
      text = text.replace(
        /^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2} \d{4}:(?=\n)/,
        'REDACTED_DATE:',
      );
    }
    return { ...part, text };
  });
}

function normalizeObservationContext(body: unknown): unknown {
  if (!isRecord(body)) return body;

  const normalizeBlocks = (blocks: unknown[], implicitSystem = false) => {
    let inObservations = false;
    const normalizeText = (text: string): string =>
      text
        .split(/(^<(?:\/?observations|current-task|suggested-response)>$)/m)
        .map(part => {
          if (part === '<observations>') inObservations = true;
          else if (['</observations>', '<current-task>', '<suggested-response>'].includes(part)) inObservations = false;
          else if (inObservations) {
            return normalizeObservationHeadings(part).replaceAll(
              /(\(meaning [^()\n]+ - )(?:today|yesterday|tomorrow|\d+ (?:day|week|month|year)s? ago|in \d+ (?:day|week|month|year)s?)(?=\))/g,
              '$1REDACTED_AGE',
            );
          }
          return part;
        })
        .join('');
    const normalizeContent = (content: unknown): unknown => {
      if (typeof content === 'string') return normalizeText(content);
      if (!Array.isArray(content)) return content;
      return content.map(part =>
        isRecord(part) && typeof part.text === 'string' ? { ...part, text: normalizeText(part.text) } : part,
      );
    };
    return blocks.map(block => {
      if (implicitSystem && typeof block === 'string') return normalizeText(block);
      if (!isRecord(block)) return block;
      if (!implicitSystem && block.role !== 'system' && block.role !== 'developer') {
        inObservations = false;
        return block.role === 'user' ? { ...block, content: normalizeObserverRequest(block.content) } : block;
      }
      return {
        ...block,
        ...(typeof block.text === 'string' ? { text: normalizeText(block.text) } : {}),
        ...(block.content !== undefined ? { content: normalizeContent(block.content) } : {}),
      };
    });
  };

  const normalized = { ...body };
  for (const key of ['input', 'messages']) {
    if (Array.isArray(body[key])) normalized[key] = normalizeBlocks(body[key]);
  }
  if (Array.isArray(body.system)) normalized.system = normalizeBlocks(body.system, true);
  else if (typeof body.system === 'string') normalized.system = normalizeBlocks([body.system], true)[0];
  return normalized;
}

export function transformRequest({ url, body }: { url: string; body: unknown }): { url: string; body: unknown } {
  let normalizedBody = normalizeObservationContext(
    normalizeOpenAIResponseFunctionCalls(normalizeNetworkFinalResultMessages(body)),
  );
  const { hostname } = new URL(url);
  if (hostname === 'generativelanguage.googleapis.com') {
    normalizedBody = normalizeGoogleToolCallMessages(normalizedBody);
  }
  if (hostname === 'openrouter.ai') {
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
  // Zod 4 adds "propertyNames":{"type":"string"} to z.record() JSON schemas; Zod 3 omits it.
  // Strip it (raw and string-escaped) so recordings match across Zod majors.
  for (const pattern of [/"propertyNames":\{"type":"string"\}/g, /\\"propertyNames\\":\{\\"type\\":\\"string\\"\}/g]) {
    stringifiedBody = stringifiedBody.replaceAll(new RegExp(`${pattern.source},`, 'g'), '');
    stringifiedBody = stringifiedBody.replaceAll(new RegExp(`,${pattern.source}`, 'g'), '');
  }
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
