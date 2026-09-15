type ProcessorMessagePart = { type: string; text?: string };

type ProcessorMessage = {
  id: string;
  role: string;
  createdAt: string;
  content: { format: number; parts: ProcessorMessagePart[] };
};

type ProcessorInput = { phase?: string; messages?: ProcessorMessage[] } & Record<string, unknown>;

const FALLBACK_MESSAGE_TEXT = 'Hello, this is a test message.';

function createProcessorMessage(text: string): ProcessorMessage {
  return {
    id: crypto.randomUUID(),
    role: 'user',
    createdAt: new Date().toISOString(),
    content: { format: 2, parts: [{ type: 'text', text }] },
  };
}

export function createProcessorInput() {
  return { messages: [createProcessorMessage(FALLBACK_MESSAGE_TEXT)], phase: 'input' };
}

export function getProcessorMessage(input: ProcessorInput) {
  if (!Array.isArray(input?.messages)) return '';
  const textPart = input.messages[0]?.content?.parts?.find(part => part.type === 'text');
  return textPart?.text ?? '';
}

export function updateProcessorMessage(input: ProcessorInput, text: string): ProcessorInput {
  const messages = Array.isArray(input?.messages) ? input.messages : [];
  const [firstMessage = createProcessorMessage(text), ...otherMessages] = messages;
  const parts = firstMessage.content?.parts ?? [];
  const textIndex = parts.findIndex(part => part.type === 'text');
  const nextParts =
    textIndex === -1
      ? [...parts, { type: 'text', text }]
      : parts.map((part, index) => (index === textIndex ? { ...part, text } : part));

  return {
    ...input,
    messages: [{ ...firstMessage, content: { ...firstMessage.content, parts: nextParts } }, ...otherMessages],
  };
}

// The processor contract ties the author of the first message to the phase being exercised.
export function withPhaseRole(input: ProcessorInput): ProcessorInput {
  if (!Array.isArray(input?.messages)) return input;
  const role = input.phase === 'outputStep' || input.phase === 'outputResult' ? 'assistant' : 'user';

  return {
    ...input,
    messages: input.messages.map((message, index) => (index === 0 ? { ...message, role } : message)),
  };
}
