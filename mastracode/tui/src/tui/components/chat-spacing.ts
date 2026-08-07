import type { Component } from '@earendil-works/pi-tui';

export type ChatSpacingKind =
  | 'quiet-compact-tool'
  | 'quiet-shell-tool'
  | 'normal-tool'
  | 'assistant-message'
  | 'user-message'
  | 'plan'
  | 'task'
  | 'system'
  | 'other';

export interface ChatSpacingParticipant {
  getChatSpacingKind(): ChatSpacingKind | undefined;
}

interface CompactToolSpacingParticipant {
  getCompactToolGroupKey?(): string | undefined;
  hasQuietStreamingPreview?(): boolean;
}

export function getChatSpacingKind(component: Component | undefined): ChatSpacingKind | undefined {
  const participant = component as Partial<ChatSpacingParticipant> | undefined;
  return participant?.getChatSpacingKind?.();
}

export function getSpacingBetweenComponents(
  prev: Component | undefined,
  next: Component | undefined,
  _prevPrev?: Component | undefined,
  _nextNext?: Component | undefined,
): number {
  const prevKind = getChatSpacingKind(prev);
  const nextKind = getChatSpacingKind(next);

  if (prevKind === 'quiet-compact-tool' && nextKind === 'quiet-compact-tool') {
    const prevKey = getCompactToolGroupKey(prev);
    const nextKey = getCompactToolGroupKey(next);
    if (prevKey && nextKey && prevKey === nextKey) return 0;
    return 1;
  }
  if (hasQuietStreamingPreview(prev) || hasQuietStreamingPreview(next)) return 1;
  return getSpacingBetween(prevKind, nextKind);
}

function getCompactToolGroupKey(component: Component | undefined): string | undefined {
  return (component as CompactToolSpacingParticipant | undefined)?.getCompactToolGroupKey?.();
}

function hasQuietStreamingPreview(component: Component | undefined): boolean {
  return (component as CompactToolSpacingParticipant | undefined)?.hasQuietStreamingPreview?.() ?? false;
}

export function getSpacingBetween(prev: ChatSpacingKind | undefined, next: ChatSpacingKind | undefined): number {
  if (!prev || !next) return 0;
  if (prev === 'quiet-compact-tool' && next === 'quiet-compact-tool') return 0;
  if (isToolSpacingKind(prev) && next === 'assistant-message') return 1;
  if (prev === 'assistant-message' && isToolSpacingKind(next)) return 1;
  return 1;
}

function isToolSpacingKind(kind: ChatSpacingKind | undefined): boolean {
  return kind === 'quiet-compact-tool' || kind === 'quiet-shell-tool' || kind === 'normal-tool';
}
