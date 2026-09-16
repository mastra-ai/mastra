import { isThreadTitlePinned } from '@mastra/core/memory';

type ThreadLike = { title?: string; metadata?: Record<string, unknown> } | null | undefined;

/**
 * Resolve the thread title an Observational Memory cycle should persist.
 *
 * Returns the trimmed candidate when it is a new, long-enough title, or
 * `undefined` when the current title must stay — including when the user
 * pinned it via `session.thread.rename()`, which sets the
 * `titlePinned` thread metadata flag.
 */
export function resolveThreadTitleUpdate(thread: ThreadLike, generatedTitle?: string): string | undefined {
  const candidate = generatedTitle?.trim();
  if (!candidate || candidate.length < 3) return undefined;
  if (isThreadTitlePinned(thread?.metadata)) return undefined;
  if (candidate === thread?.title?.trim()) return undefined;
  return candidate;
}
