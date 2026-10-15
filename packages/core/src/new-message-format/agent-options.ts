import type { RequestContext } from '../request-context';

export type ActionRunOptions = {
  memory?: { thread: string | { id: string }; resource?: string };
  requestContext?: RequestContext;
  maxSteps?: number;
  abortSignal?: AbortSignal;
};

export type ActionResumeOptions = ActionRunOptions & { runId: string; toolCallId?: string };

type InstructionPart = string | { content?: unknown; text?: unknown } | null | undefined;

/** Flattens Mastra agent instructions (string, system messages, or arrays of either) to plain text. */
export function instructionsToText(instructions: InstructionPart | InstructionPart[]): string {
  const parts = Array.isArray(instructions) ? instructions : [instructions];
  return parts
    .map(part => {
      if (!part) return '';
      if (typeof part === 'string') return part;
      if (typeof part.content === 'string') return part.content;
      if (Array.isArray(part.content)) {
        return part.content.map(c => (c && typeof c === 'object' && 'text' in c ? String(c.text) : '')).join('');
      }
      return typeof part.text === 'string' ? part.text : '';
    })
    .filter(Boolean)
    .join('\n\n');
}
