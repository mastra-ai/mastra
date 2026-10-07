export interface ReasoningContent {
  text: string;
  redacted?: boolean;
  streaming?: boolean;
}

export function hasVisibleReasoning({ text, redacted, streaming }: ReasoningContent): boolean {
  return Boolean(streaming || redacted) || text.trim().length > 0;
}
