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

/** Set on messages built with `asUserTurn`, so the model can keep that outer tag. */
export const AUTHORED_USER_TURN = 'userTurn';

/**
 * Neutralize turn tags in text the model will read.
 *
 * An authored turn keeps its one outer `<turn>` and escapes any further turn tags
 * inside it. Every other message has every turn tag escaped, including a message
 * whose whole text is a single `<turn>`.
 */
export function sealTurnMarkup(content: string, options?: { authored?: boolean }): string {
  if (!/<\/?turn\b/i.test(content)) return content;
  if (!options?.authored) return escapeTurnTags(content);

  const wrapped = /^(\s*<turn\b[^>]*>)([\s\S]*)(<\/turn>\s*)$/i.exec(content);
  if (!wrapped) return escapeTurnTags(content);

  const body = escapeTurnTags(wrapped[2] ?? '');
  if (body === wrapped[2]) return content;
  return `${wrapped[1]}${body}${wrapped[3]}`;
}

function isAuthoredUserTurn(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object') return false;
  const mastra = (metadata as { mastra?: unknown }).mastra;
  return !!mastra && typeof mastra === 'object' && (mastra as { userTurn?: unknown }).userTurn === true;
}

export function messageDeclaresAuthoredTurn(message: unknown): boolean {
  if (!message || typeof message !== 'object') return false;
  const record = message as { metadata?: unknown; content?: unknown };
  if (isAuthoredUserTurn(record.metadata)) return true;
  const content = record.content;
  if (!content || typeof content !== 'object' || Array.isArray(content)) return false;
  return isAuthoredUserTurn((content as { metadata?: unknown }).metadata);
}

function withoutUserTurn(metadata: unknown): unknown {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return metadata;
  const record = metadata as Record<string, unknown>;
  const mastra = record.mastra;
  if (!mastra || typeof mastra !== 'object' || Array.isArray(mastra) || !('userTurn' in mastra)) return metadata;
  const { userTurn: _userTurn, ...rest } = mastra as Record<string, unknown>;
  if (Object.keys(rest).length === 0) {
    const { mastra: _mastra, ...metaRest } = record;
    return Object.keys(metaRest).length === 0 ? undefined : metaRest;
  }
  return { ...record, mastra: rest };
}

/** Drop a client-supplied authored-turn mark. In-process `asUserTurn` calls are not passed through this. */
export function stripClientAuthoredTurnMarks(messages: unknown): void {
  if (!Array.isArray(messages)) return;
  for (let index = 0; index < messages.length; index++) {
    const message = messages[index];
    if (!message || typeof message !== 'object') continue;
    const record = message as Record<string, unknown>;
    let next = record;
    const metadata = withoutUserTurn(record.metadata);
    if (metadata !== record.metadata) next = { ...next, metadata };
    const content = record.content;
    if (content && typeof content === 'object' && !Array.isArray(content)) {
      const contentRecord = content as Record<string, unknown>;
      const contentMetadata = withoutUserTurn(contentRecord.metadata);
      if (contentMetadata !== contentRecord.metadata) {
        next = { ...next, content: { ...contentRecord, metadata: contentMetadata } };
      }
    }
    messages[index] = next;
  }
}

/**
 * Wrap one user's text in a `<turn>` tag.
 *
 * Speaker fields must come from the authenticated caller. The message text is escaped
 * so it cannot close this turn or open another one that claims a different person or role.
 */
export function asUserTurn(
  speaker: TurnSpeaker,
  text: string,
): {
  role: 'user';
  content: string;
  metadata: { mastra: { userTurn: true } };
} {
  return {
    role: 'user',
    content: `<turn author_id="${escapeTurnAttribute(speaker.id)}" author_name="${escapeTurnAttribute(speaker.name)}" functional_role="${escapeTurnAttribute(speaker.role)}">\n${escapeTurnMarkup(text)}\n</turn>`,
    metadata: { mastra: { [AUTHORED_USER_TURN]: true } },
  };
}

interface TurnTextPart {
  type?: string;
  text?: string;
}

interface TurnMessageContent {
  parts?: TurnTextPart[];
  content?: unknown;
  metadata?: unknown;
}

interface TurnMessage {
  role?: string;
  content?: TurnMessageContent;
}

/** Seal turn tags in a copy of a user message for the model. Returns the same object when nothing changes. */
export function sealUserTurnMessage<T extends TurnMessage>(message: T): T {
  if (message.role !== 'user' || !message.content) return message;

  const content = message.content;
  const authored = isAuthoredUserTurn(content.metadata);
  let changed = false;
  const parts = content.parts?.map(part => {
    if (part?.type !== 'text' || typeof part.text !== 'string') return part;
    const text = sealTurnMarkup(part.text, { authored });
    if (text === part.text) return part;
    changed = true;
    return { ...part, text };
  });

  let contentText = content.content;
  if (typeof contentText === 'string') {
    const sealed = sealTurnMarkup(contentText, { authored });
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
