function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractContentText(value: unknown): string[] {
  if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
  if (Array.isArray(value)) return value.flatMap(extractContentText);
  if (!isRecord(value)) return [];

  if (typeof value.text === 'string') return extractContentText(value.text);
  if (value.content !== undefined) return extractContentText(value.content);
  if (typeof value.value === 'string') return extractContentText(value.value);
  return [];
}

function getMessageRole(message: unknown): string | undefined {
  if (!isRecord(message)) return undefined;
  if (typeof message.role === 'string') return message.role;
  if (typeof message.type === 'string') return message.type;
  return undefined;
}

function getMessageBody(message: unknown): unknown {
  if (!isRecord(message)) return undefined;
  return message.contents ?? message.content;
}

function isMessage(value: unknown): boolean {
  return getMessageRole(value) !== undefined && getMessageBody(value) !== undefined;
}

function getMessageList(value: unknown): unknown[] | undefined {
  if (Array.isArray(value)) return value;
  if (isRecord(value) && Array.isArray(value.messages)) return value.messages;
  if (isMessage(value)) return [value];
  return undefined;
}

function getMessageText(messages: unknown[], role: 'user' | 'assistant'): string {
  return messages
    .filter(message => getMessageRole(message) === role)
    .flatMap(message => extractContentText(getMessageBody(message)))
    .join('\n\n');
}

function humanizeKey(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

function formatStructuredValue(value: unknown, depth = 0): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value
      .map(item => formatStructuredValue(item, depth + 1))
      .filter(Boolean)
      .map(item => `${'  '.repeat(depth)}- ${item}`)
      .join('\n');
  }
  if (!isRecord(value)) return String(value);

  return Object.entries(value)
    .map(([key, item]) => {
      const formatted = formatStructuredValue(item, depth + 1);
      if (!formatted) return '';
      return formatted.includes('\n')
        ? `${'  '.repeat(depth)}${humanizeKey(key)}:\n${formatted}`
        : `${'  '.repeat(depth)}${humanizeKey(key)}: ${formatted}`;
    })
    .filter(Boolean)
    .join('\n');
}

export function getReadableTraceInput(input: unknown): string {
  const messages = getMessageList(input);
  if (messages) return getMessageText(messages, 'user');

  const directText = extractContentText(input).join('\n\n');
  return directText || formatStructuredValue(input);
}

export function getReadableTraceOutput(output: unknown): string {
  const messages = getMessageList(output);
  if (messages) return getMessageText(messages, 'assistant');

  if (isRecord(output)) {
    for (const key of ['text', 'content', 'output', 'result', 'message']) {
      const text = extractContentText(output[key]).join('\n\n');
      if (text) return text;
    }
  }

  const directText = extractContentText(output).join('\n\n');
  return directText || formatStructuredValue(output);
}
