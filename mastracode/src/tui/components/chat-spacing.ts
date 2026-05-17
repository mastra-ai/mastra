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

export function getChatSpacingKind(component: Component | undefined): ChatSpacingKind | undefined {
  const participant = component as Partial<ChatSpacingParticipant> | undefined;
  return participant?.getChatSpacingKind?.();
}

export function getSpacingBetween(prev: ChatSpacingKind | undefined, next: ChatSpacingKind | undefined): number {
  if (!prev || !next) return 0;
  if (prev === 'quiet-compact-tool' && next === 'quiet-compact-tool') return 0;
  return 1;
}
