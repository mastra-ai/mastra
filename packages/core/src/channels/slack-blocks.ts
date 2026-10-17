/**
 * Text of Slack Block Kit layout blocks (`header`, `section`, `context`,
 * `markdown`) in `raw.blocks`, one entry per block, with mrkdwn links converted
 * to markdown. Empty when `raw` carries no such blocks.
 *
 * `@chat-adapter/slack` builds `Message.formatted` from the `text` fallback
 * only, so bot and webhook messages that put their content in blocks would
 * otherwise reach the agent as just the notification fallback.
 */
export function layoutBlockTexts(raw: unknown): string[] {
  const blocks = isRecord(raw) ? raw.blocks : undefined;
  if (!Array.isArray(blocks)) return [];

  const texts: string[] = [];
  for (const block of blocks) {
    if (!isRecord(block) || typeof block.type !== 'string') continue;
    const text = blockText(block).trim();
    if (text) texts.push(text);
  }
  return texts;
}

function blockText(block: Record<string, unknown>): string {
  switch (block.type) {
    case 'header':
      return textObject(block.text);
    case 'section': {
      const fields = Array.isArray(block.fields) ? block.fields.map(textObject) : [];
      return [textObject(block.text), ...fields].filter(Boolean).join('\n');
    }
    case 'context': {
      const elements = Array.isArray(block.elements) ? block.elements : [];
      return elements
        .filter(el => isRecord(el) && (el.type === 'mrkdwn' || el.type === 'plain_text'))
        .map(textObject)
        .filter(Boolean)
        .join(' ');
    }
    case 'markdown':
      return typeof block.text === 'string' ? block.text : '';
    default:
      return '';
  }
}

function textObject(value: unknown): string {
  if (!isRecord(value) || typeof value.text !== 'string') return '';
  const text = value.text.trim();
  return value.type === 'mrkdwn' ? slackLinksToMarkdown(text) : text;
}

/** `<url|label>` → `[label](url)` and `<url>` → `url`; mentions and `<!here>` are left as-is. */
function slackLinksToMarkdown(text: string): string {
  return text.replace(/<((?:https?:\/\/|mailto:)[^|>\s]+)(?:\|([^>]*))?>/g, (_match, url: string, label?: string) =>
    label ? `[${label}](${url})` : url,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
