export interface ReasoningContent {
  text: string;
  redacted?: boolean;
  streaming?: boolean;
}

export function hasVisibleReasoning({ text, redacted, streaming }: ReasoningContent): boolean {
  return Boolean(streaming || redacted) || hasReasoningText({ text, redacted });
}

/** Whether the passage has something to read: its text, or the notice that it was redacted. */
export function hasReasoningText({ text, redacted }: ReasoningContent): boolean {
  return Boolean(redacted) || text.trim().length > 0;
}
