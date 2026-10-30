import type { PendingImage } from '../context/ComposerImagesContext';

// Attachments for a session's first prompt cross the draft -> thread navigation
// in memory rather than in history state: base64 images can exceed browsers'
// history state size limits, and a reload never auto-resends anyway.
const handoffFiles = new Map<string, PendingImage[]>();

export function stashHandoffFiles(resourceId: string, files: PendingImage[]): void {
  if (files.length > 0) handoffFiles.set(resourceId, files);
  else handoffFiles.delete(resourceId);
}

export function takeHandoffFiles(resourceId: string): PendingImage[] {
  const files = handoffFiles.get(resourceId) ?? [];
  handoffFiles.delete(resourceId);
  return files;
}

/**
 * Route state that returns a draft whose session failed to start to its
 * composer. Its images stay stashed under the draft's id, so they are read
 * without taking: state initializers can run more than once.
 */
export function failedDraftState(prompt: string, routeErrorNotice: string) {
  return { failedDraftPrompt: prompt, routeErrorNotice };
}

export function readFailedDraft(
  state: unknown,
  draftSessionId: string | undefined,
): { prompt: string; files: PendingImage[] } | undefined {
  if (!draftSessionId || typeof state !== 'object' || state === null || !('failedDraftPrompt' in state)) {
    return undefined;
  }
  const prompt: unknown = state.failedDraftPrompt;
  if (typeof prompt !== 'string') return undefined;
  return { prompt, files: handoffFiles.get(draftSessionId) ?? [] };
}
