/**
 * Text of Slack Block Kit layout blocks (`header`, `section`, `context`,
 * `markdown`) in `raw.blocks`, one entry per block, with mrkdwn links converted
 * to markdown. Each entry lists the block's parts (a section's text and each
 * of its fields) so callers can drop parts they already have. Empty when `raw`
 * carries no such blocks.
 *
 * `@chat-adapter/slack` builds `Message.formatted` from the `text` fallback
 * only, so bot and webhook messages that put their content in blocks would
 * otherwise reach the agent as just the notification fallback.
 */
export function layoutBlockTexts(raw: unknown): string[][] {
  const blocks = isRecord(raw) ? raw.blocks : undefined;
  if (!Array.isArray(blocks)) return [];

  const texts: string[][] = [];
  for (const block of blocks) {
    if (!isRecord(block) || typeof block.type !== 'string') continue;
    const parts = blockParts(block)
      .map(part => part.trim())
      .filter(Boolean);
    if (parts.length) texts.push(parts);
  }
  return texts;
}

function blockParts(block: Record<string, unknown>): string[] {
  switch (block.type) {
    case 'header':
      return [textObject(block.text)];
    case 'section': {
      const fields = Array.isArray(block.fields) ? block.fields.map(textObject) : [];
      return [textObject(block.text), ...fields];
    }
    case 'context': {
      const elements = Array.isArray(block.elements) ? block.elements : [];
      const text = elements
        .filter(el => isRecord(el) && (el.type === 'mrkdwn' || el.type === 'plain_text'))
        .map(textObject)
        .filter(Boolean)
        .join(' ');
      return [text];
    }
    case 'markdown':
      return [typeof block.text === 'string' ? block.text : ''];
    default:
      return [];
  }
}

function textObject(value: unknown): string {
  if (!isRecord(value) || typeof value.text !== 'string') return '';
  const text = value.text.trim();
  return value.type === 'mrkdwn' ? slackLinksToMarkdown(text) : text;
}

/** `<url|label>` → `[label](url)` and `<url>` → `url`; mentions and `<!here>` are left as-is. */
function slackLinksToMarkdown(text: string): string {
  return text.replace(/<((?:https?:\/\/|mailto:)[^|>\s]+)(?:\|([^>]*))?>/g, (_match, url: string, label?: string) => {
    if (!label) return url;
    const destination = /[()<>]/.test(url) ? `<${url.replace(/[<>]/g, encodeURIComponent)}>` : url;
    return `[${label.replace(/[\\[\]]/g, '\\$&')}](${destination})`;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
