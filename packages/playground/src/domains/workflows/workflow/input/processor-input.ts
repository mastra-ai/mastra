import type { WorkflowInputDataProps } from '../workflow-input-data';

export function createProcessorInput(value: WorkflowInputDataProps['defaultValues']) {
  if (value !== undefined && value !== null) return value;
  return {
    messages: [
      {
        id: crypto.randomUUID(),
        role: 'user',
        createdAt: new Date().toISOString(),
        content: { format: 2, parts: [{ type: 'text', text: 'Hello, this is a test message.' }] },
      },
    ],
    phase: 'input',
  };
}

export function getProcessorMessage(value: WorkflowInputDataProps['defaultValues']) {
  const part = value.messages[0]?.content.parts.find((part: { type: string; text?: string }) => part.type === 'text');
  return part?.text ?? '';
}

export function updateProcessorMessage(value: WorkflowInputDataProps['defaultValues'], message: string) {
  const firstMessage = value.messages[0] ?? createProcessorInput(undefined).messages[0];
  const otherMessages = value.messages.slice(1);
  const parts = firstMessage.content.parts;
  const textIndex = parts.findIndex((part: { type: string }) => part.type === 'text');
  const nextParts = parts.map((part: { type: string }, index: number) =>
    index === textIndex ? { ...part, text: message } : part,
  );
  if (textIndex === -1) nextParts.push({ type: 'text', text: message });
  return {
    ...value,
    messages: [{ ...firstMessage, content: { ...firstMessage.content, parts: nextParts } }, ...otherMessages],
  };
}
