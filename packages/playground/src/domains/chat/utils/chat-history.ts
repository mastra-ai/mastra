import { z } from 'zod/v4';

const historySchema = z.array(z.object({ agentId: z.string(), threadId: z.string() })).max(12);
export type ChatHistoryEntry = z.infer<typeof historySchema>[number];

export function chatHistoryKey(baseUrl: string, apiPrefix?: string, userId?: string) {
  return `mastra:studio:chat-history:v1:${JSON.stringify([baseUrl, apiPrefix, userId])}`;
}

export function readChatHistory(key: string): ChatHistoryEntry[] {
  try {
    const parsed = historySchema.safeParse(JSON.parse(localStorage.getItem(key) ?? '[]'));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export function rememberChat(key: string, entry: ChatHistoryEntry) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify([entry, ...readChatHistory(key).filter(item => item.agentId !== entry.agentId)].slice(0, 12)),
    );
  } catch {
    /* Chat still works when browser storage is unavailable. */
  }
}
