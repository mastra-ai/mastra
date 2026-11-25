export interface PromptHandoff {
  handoffPrompt: string;
  handoffShownMessageId?: string;
}

// An image-only first prompt hands off an empty string, so only a missing field means "no handoff".
export function readHandoffPrompt(state: unknown): string | undefined {
  if (typeof state !== 'object' || state === null || !('handoffPrompt' in state)) return undefined;
  return typeof state.handoffPrompt === 'string' ? state.handoffPrompt : undefined;
}

export function opensWithPrompt(state: unknown): boolean {
  return readHandoffPrompt(state) !== undefined;
}
