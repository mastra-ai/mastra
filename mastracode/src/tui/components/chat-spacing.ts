import type { Component } from '@mariozechner/pi-tui';

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
}

export function getChatSpacingKind(component: Component | undefined): ChatSpacingKind | undefined {
  const participant = component as Partial<ChatSpacingParticipant> | undefined;
  return participant?.getChatSpacingKind?.();
}

export function getSpacingBetweenComponents(
  prev: Component | undefined,
  next: Component | undefined,
  prevPrev?: Component | undefined,
  nextNext?: Component | undefined,
): number {
  const prevKind = getChatSpacingKind(prev);
  const nextKind = getChatSpacingKind(next);
  if (prevKind === 'quiet-compact-tool' && nextKind === 'quiet-compact-tool') {
    const prevKey = getCompactToolGroupKey(prev);
    const nextKey = getCompactToolGroupKey(next);
    if (prevKey && nextKey && prevKey === nextKey) return 0;

    const prevIsRunEnd = !!prevKey && prevKey === getCompactToolGroupKey(prevPrev);
    const nextIsRunStart = !!nextKey && nextKey === getCompactToolGroupKey(nextNext);
    return prevIsRunEnd || nextIsRunStart ? 1 : 0;
  }
  return getSpacingBetween(prevKind, nextKind);
}

function getCompactToolGroupKey(component: Component | undefined): string | undefined {
  return (component as CompactToolSpacingParticipant | undefined)?.getCompactToolGroupKey?.();
}

export function getSpacingBetween(prev: ChatSpacingKind | undefined, next: ChatSpacingKind | undefined): number {
  if (!prev || !next) return 0;
  if (prev === 'quiet-compact-tool' && next === 'quiet-compact-tool') return 0;
  return 1;
}
