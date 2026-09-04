import type { Adapter } from 'chat';

export interface SlackMention {
  id: string;
  label: string;
}

export async function resolveSlackMentions(
  adapter: Pick<Adapter, 'name' | 'getUser'>,
  raw: unknown,
): Promise<SlackMention[]> {
  if (adapter.name !== 'slack' || !adapter.getUser || typeof raw !== 'object' || raw === null) return [];
  const event = 'event' in raw && typeof raw.event === 'object' && raw.event !== null ? raw.event : raw;
  if (!('text' in event) || typeof event.text !== 'string') return [];
  const ids = [...new Set([...event.text.matchAll(/<@([UW][A-Z0-9]+)(?:\|[^>]+)?>/g)].map(match => match[1]!))];
  const mentions = await Promise.all(
    ids.map(async id => {
      const user = await adapter.getUser!(id);
      return user ? { id, label: `@${user.userName || id}` } : undefined;
    }),
  );
  return mentions.filter(mention => mention !== undefined);
}
