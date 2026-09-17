import { nanoid } from 'nanoid';
import { z } from 'zod';

const processorPartSchema = z.object({ type: z.string(), text: z.string().optional() }).passthrough();
const processorMessageSchema = z
  .object({
    content: z
      .object({ parts: z.array(processorPartSchema).optional() })
      .passthrough()
      .optional(),
  })
  .passthrough();
const processorDraftSchema = z
  .object({ phase: z.string().optional(), messages: z.array(processorMessageSchema).optional() })
  .passthrough();

export type ProcessorDraft = z.infer<typeof processorDraftSchema>;
type ProcessorMessage = NonNullable<ProcessorDraft['messages']>[number];

const FALLBACK_MESSAGE_TEXT = 'Hello, this is a test message.';

export function parseProcessorDraft(input: unknown): ProcessorDraft | undefined {
  const result = processorDraftSchema.safeParse(input);
  return result.success ? result.data : undefined;
}

function createProcessorMessage(text: string): ProcessorMessage {
  return {
    id: nanoid(),
    role: 'user',
    createdAt: new Date().toISOString(),
    content: { format: 2, parts: [{ type: 'text', text }] },
  };
}

export function createProcessorInput(): ProcessorDraft {
  return { messages: [createProcessorMessage(FALLBACK_MESSAGE_TEXT)], phase: 'input' };
}

export function getProcessorMessage(draft: ProcessorDraft) {
  return draft.messages?.[0]?.content?.parts?.find(part => part.type === 'text')?.text ?? '';
}

export function updateProcessorMessage(draft: ProcessorDraft, text: string): ProcessorDraft {
  const [firstMessage = createProcessorMessage(text), ...otherMessages] = draft.messages ?? [];
  const parts = firstMessage.content?.parts ?? [];
  const textIndex = parts.findIndex(part => part.type === 'text');
  const nextParts =
    textIndex === -1
      ? [...parts, { type: 'text', text }]
      : parts.map((part, index) => (index === textIndex ? { ...part, text } : part));

  return {
    ...draft,
    messages: [{ ...firstMessage, content: { ...firstMessage.content, parts: nextParts } }, ...otherMessages],
  };
}

// Output phases feed the processor an assistant message, every other phase a user message.
export function withPhaseRole(draft: ProcessorDraft): ProcessorDraft {
  if (!draft.messages) return draft;
  const role = draft.phase === 'outputStep' || draft.phase === 'outputResult' ? 'assistant' : 'user';

  return {
    ...draft,
    messages: draft.messages.map((message, index) => (index === 0 ? { ...message, role } : message)),
  };
}
