const TURN_TAG = /<\/?turn\b[^>]*>/gi;

export interface TurnSpeaker {
  id: string;
  name: string;
  role: string;
}

/** Escape `&`, `<`, and `>` so user text cannot be read as markup. */
export function escapeTurnMarkup(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeTurnAttribute(value: string): string {
  return escapeTurnMarkup(value)
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/[\r\n]+/g, ' ');
}

function escapeTurnTags(value: string): string {
  return value.replace(TURN_TAG, tag => tag.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
}

/**
 * Neutralize turn-tag breakout in message text.
 *
 * A single outer `<turn>...</turn>` written by the application is kept, and any
 * further turn tags inside it are escaped. Text that is not one outer turn has
 * every turn tag escaped, so a stored payload cannot close one turn and open another.
 * A turn the application already escaped is left as-is.
 */
export function sealTurnMarkup(content: string): string {
  if (!/<\/?turn\b/i.test(content)) return content;

  const wrapped = /^(\s*<turn\b[^>]*>)([\s\S]*)(<\/turn>\s*)$/i.exec(content);
  if (!wrapped) return escapeTurnTags(content);

  const body = escapeTurnTags(wrapped[2] ?? '');
  if (body === wrapped[2]) return content;
  return `${wrapped[1]}${body}${wrapped[3]}`;
}

/**
 * Wrap one user's text in a `<turn>` tag.
 *
 * Speaker fields must come from the authenticated caller. The message text is escaped
 * so it cannot close this turn or open another one that claims a different person or role.
 */
export function asUserTurn(speaker: TurnSpeaker, text: string): { role: 'user'; content: string } {
  return {
    role: 'user',
    content: `<turn author_id="${escapeTurnAttribute(speaker.id)}" author_name="${escapeTurnAttribute(speaker.name)}" functional_role="${escapeTurnAttribute(speaker.role)}">\n${escapeTurnMarkup(text)}\n</turn>`,
  };
}

interface TurnTextPart {
  type?: string;
  text?: string;
}

interface TurnMessageContent {
  parts?: TurnTextPart[];
  content?: unknown;
}

interface TurnMessage {
  role?: string;
  content?: TurnMessageContent;
}

/** Seal turn-tag breakout in a user message. Returns the same object when nothing changes. */
export function sealUserTurnMessage<T extends TurnMessage>(message: T): T {
  if (message.role !== 'user' || !message.content) return message;

  const content = message.content;
  let changed = false;
  const parts = content.parts?.map(part => {
    if (part?.type !== 'text' || typeof part.text !== 'string') return part;
    const text = sealTurnMarkup(part.text);
    if (text === part.text) return part;
    changed = true;
    return { ...part, text };
  });

  let contentText = content.content;
  if (typeof contentText === 'string') {
    const sealed = sealTurnMarkup(contentText);
    if (sealed !== contentText) {
      changed = true;
      contentText = sealed;
    }
  }

  if (!changed) return message;
  return {
    ...message,
    content: {
      ...content,
      ...(parts ? { parts } : {}),
      ...(typeof content.content === 'string' ? { content: contentText } : {}),
    },
  };
}
