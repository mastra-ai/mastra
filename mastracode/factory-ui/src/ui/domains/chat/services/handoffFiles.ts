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
