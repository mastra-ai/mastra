import type { ModelSelectionRequest } from '@mastra/factory/model-packs';

import type { PendingImage } from '../context/ComposerImagesContext';
import { DEFAULT_MODEL_SELECTION, readModelSelection } from './modelSelection';

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
  modelSelection: ModelSelectionRequest;
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
  const modelSelection = 'modelSelection' in draft ? readModelSelection(draft.modelSelection) : undefined;
  return {
    prompt: draft.prompt,
    modelSelection: modelSelection ?? DEFAULT_MODEL_SELECTION,
    files: peekHandoffFiles(draftSessionId),
  };
}
