const SYSTEM_REMINDER_REGEX = /<system-reminder(?:\s+([^>]*?))?>([\s\S]*?)<\/system-reminder>/i;

function decodeXmlEntities(value: string): string {
  return value.replaceAll('&quot;', '"').replaceAll('&gt;', '>').replaceAll('&lt;', '<').replaceAll('&amp;', '&');
}

function parseAttributes(rawAttributes: string): Record<string, string> {
  return Object.fromEntries(
    [...rawAttributes.matchAll(/(\w+)="([^"]*)"/g)].map(([, key, value]) => [key, decodeXmlEntities(value)]),
  );
}

export function parseSystemReminder(text: string): { path?: string; type?: string; body: string } | null {
  const match = text.match(SYSTEM_REMINDER_REGEX);
  if (!match) {
    return null;
  }

  const [, rawAttributes = '', rawBody = ''] = match;
  const attributes = parseAttributes(rawAttributes);

  return {
    path: attributes.path,
    type: attributes.type,
    body: decodeXmlEntities(rawBody).trim(),
  };
}
