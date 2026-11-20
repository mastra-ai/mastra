import type { MastraDBMessage } from '@mastra/core/agent';
import { resolveToolResultValue } from '../processors/observational-memory/tool-result-helpers';
import type { RecallSearchResult } from './om-tools';

export function searchContextKey(match: Pick<RecallSearchResult, 'threadId' | 'groupId'>): string {
  return JSON.stringify([match.threadId, match.groupId]);
}

/** Read only real recall results, not quoted tool output in user or assistant text. */
export function getVisibleSearchExcerpts(messages: readonly MastraDBMessage[]): Map<string, string[]> {
  const excerpts = new Map<string, string[]>();
  for (const message of messages) {
    if (message.role !== 'assistant') continue;
    for (const part of message.content.parts) {
      if (part.type !== 'tool-invocation') continue;
      const invocation = part.toolInvocation;
      if (invocation.toolName !== 'recall' || invocation.state !== 'result' || invocation.args?.mode !== 'search')
        continue;
      const resolved = resolveToolResultValue(part, invocation.result);
      let value = resolved.value;
      if (resolved.usingStoredModelOutput) {
        // A custom model output can hide the original result. Never dedupe against that hidden value.
        if (!value || typeof value !== 'object' || !('type' in value) || value.type !== 'json' || !('value' in value))
          continue;
        value = value.value;
      }
      if (!value || typeof value !== 'object' || !('results' in value) || typeof value.results !== 'string') continue;
      for (const section of value.results.split(/^### (?:Current thread memory|Memory from another thread)\s*$/m)) {
        const threadId = /^- thread: (\S+)/m.exec(section)?.[1];
        const cursor = /^- observation group: ([^\n]+)$/m.exec(section)?.[1];
        const groupId = cursor?.split('@')[0];
        const excerpt = /\n```text\n([\s\S]*?)\n```/.exec(section)?.[1];
        if (!threadId || !groupId || !excerpt) continue;
        const key = searchContextKey({ threadId, groupId });
        const previous = excerpts.get(key) ?? [];
        previous.push(excerpt);
        excerpts.set(key, previous);
      }
    }
  }
  return excerpts;
}

export function sourceRangeOverlapsContext({
  match,
  messages,
}: {
  match: RecallSearchResult;
  messages: readonly MastraDBMessage[];
}): boolean {
  if (!match.groupId || !match.range) return false;
  const endpoints = /^([^:,]+):([^:,]+)$/.exec(match.range);
  if (!endpoints) return false;
  // Fallback for when the current OM record can't be read. A group's messages normally leave context
  // together, so a lone endpoint is a message kept back, such as a tool call awaiting its result.
  const visible = new Set(messages.filter(message => message.threadId === match.threadId).map(message => message.id));
  return visible.has(endpoints[1]!) && visible.has(endpoints[2]!);
}
