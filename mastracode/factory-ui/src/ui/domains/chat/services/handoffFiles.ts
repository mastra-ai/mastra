import { isThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';

import type { PendingImage } from '../context/ComposerImagesContext';

// Attachments for a session's first prompt cross the draft -> thread navigation
// in memory rather than in history state: base64 images can exceed browsers'
// history state size limits, and a reload never auto-resends anyway.
const handoffFiles = new Map<string, PendingImage[]>();

export function stashHandoffFiles(resourceId: string, files: PendingImage[]): void {
  if (files.length > 0) handoffFiles.set(resourceId, files);
  else handoffFiles.delete(resourceId);
}

/** Reads without taking, for renders that may run more than once. */
export function peekHandoffFiles(resourceId: string): PendingImage[] {
  return handoffFiles.get(resourceId) ?? [];
}

export function takeHandoffFiles(resourceId: string): PendingImage[] {
  const files = handoffFiles.get(resourceId) ?? [];
  handoffFiles.delete(resourceId);
  return files;
}

export interface FailedDraft {
  prompt: string;
  modelId?: string;
  thinkingLevel?: ThinkingLevelSetting;
}

/**
 * Route state that returns a draft whose session failed to start to its
 * composer. Its images stay stashed under the draft's id, so they are read
 * without taking: state initializers can run more than once.
 */
export function failedDraftState(failedDraft: FailedDraft, routeErrorNotice: string) {
  return { failedDraft, routeErrorNotice };
}

export function readFailedDraft(
  state: unknown,
  draftSessionId: string | undefined,
): (FailedDraft & { files: PendingImage[] }) | undefined {
  if (!draftSessionId || typeof state !== 'object' || state === null || !('failedDraft' in state)) return undefined;
  const draft: unknown = state.failedDraft;
  if (typeof draft !== 'object' || draft === null || !('prompt' in draft) || typeof draft.prompt !== 'string') {
    return undefined;
  }
  const modelId = 'modelId' in draft && typeof draft.modelId === 'string' ? draft.modelId : undefined;
  const thinkingLevel =
    'thinkingLevel' in draft && isThinkingLevelSetting(draft.thinkingLevel) ? draft.thinkingLevel : undefined;
  return { prompt: draft.prompt, modelId, thinkingLevel, files: peekHandoffFiles(draftSessionId) };
}
