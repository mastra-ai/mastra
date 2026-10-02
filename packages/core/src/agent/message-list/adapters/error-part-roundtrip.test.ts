import { describe, expect, it } from 'vitest';

import { MessageList } from '../message-list';
import type { MastraDBMessage, MastraErrorPart, MastraMessagePart } from '../state/types';
import { AIV4Adapter, type AIV4AdapterContext } from './AIV4Adapter';
import { AIV5Adapter } from './AIV5Adapter';
import { AIV6Adapter } from './AIV6Adapter';

const ERROR_PART: MastraErrorPart = {
  type: 'error',
  error: { name: 'APICallError', message: 'model exploded' },
};

const PARTIAL_PARTS: MastraMessagePart[] = [
  { type: 'text', text: 'partial answer' },
  { type: 'reasoning', reasoning: 'partial reasoning', details: [] },
];

function makeDbMessage(parts: MastraMessagePart[], id = 'assistant-1'): MastraDBMessage {
  return {
    id,
    role: 'assistant',
    createdAt: new Date(),
    threadId: 'thread-1',
    resourceId: 'resource-1',
    content: { format: 2, parts: structuredClone(parts) },
  };
}

function errorPartsOf(parts: unknown): MastraErrorPart[] {
  return ((parts ?? []) as MastraMessagePart[]).filter(part => part?.type === 'error') as MastraErrorPart[];
}

const adapterContext: AIV4AdapterContext = {
  memoryInfo: { threadId: 'thread-1', resourceId: 'resource-1' },
  newMessageId: () => 'generated-id',
  generateCreatedAt: () => new Date(),
};

/** A list holding a user turn followed by the assistant record under test. */
function makeList(assistantParts: MastraMessagePart[]): MessageList {
  const messageList = new MessageList({ threadId: 'thread-1', resourceId: 'resource-1' });
  messageList.add('what is the weather?', 'input');
  messageList.add(makeDbMessage(assistantParts), 'response');
  return messageList;
}

function promptText(prompt: unknown): string {
  return JSON.stringify(prompt);
}

describe('error part survives DB -> UI conversion', () => {
  const cases: Array<{ name: string; parts: MastraMessagePart[] }> = [
    { name: 'error-only', parts: [ERROR_PART] },
    { name: 'partial plus error', parts: [...PARTIAL_PARTS, ERROR_PART] },
  ];

  for (const { name, parts } of cases) {
    it(`AIV4 keeps the payload for ${name}`, () => {
      const ui = AIV4Adapter.toUIMessage(makeDbMessage(parts));

      expect(errorPartsOf(ui.parts)).toEqual([ERROR_PART]);
      expect((ui.parts as MastraMessagePart[]).map(part => part.type)).toEqual(parts.map(part => part.type));
    });

    it(`AIV5 keeps the payload for ${name}`, () => {
      const ui = AIV5Adapter.toUIMessage(makeDbMessage(parts));

      expect(errorPartsOf(ui.parts)).toEqual([ERROR_PART]);
      expect((ui.parts as unknown as MastraMessagePart[]).map(part => part.type)).toEqual(parts.map(part => part.type));
    });

    it(`AIV6 keeps the payload for ${name}`, () => {
      const ui = AIV6Adapter.toUIMessage(makeDbMessage(parts));

      expect(errorPartsOf(ui.parts)).toEqual([ERROR_PART]);
      expect((ui.parts as unknown as MastraMessagePart[]).map(part => part.type)).toEqual(parts.map(part => part.type));
    });
  }

  it('AIV6 does not duplicate the error part through its v5 bridge', () => {
    const ui = AIV6Adapter.toUIMessage(makeDbMessage([...PARTIAL_PARTS, ERROR_PART]));

    expect(errorPartsOf(ui.parts)).toHaveLength(1);
    expect((ui.parts as unknown as MastraMessagePart[]).map(part => part.type)).toEqual(['text', 'reasoning', 'error']);
  });
});

describe('error part survives DB -> UI -> DB round-trip', () => {
  it('AIV4 preserves order and payload', () => {
    const db = makeDbMessage([...PARTIAL_PARTS, ERROR_PART]);
    const roundTripped = AIV4Adapter.fromUIMessage(AIV4Adapter.toUIMessage(db), adapterContext, 'response');

    expect(roundTripped.content.parts?.map(part => part.type)).toEqual(['text', 'reasoning', 'error']);
    expect(errorPartsOf(roundTripped.content.parts)).toEqual([ERROR_PART]);
  });

  it('AIV5 preserves order and payload', () => {
    const db = makeDbMessage([...PARTIAL_PARTS, ERROR_PART]);
    const roundTripped = AIV5Adapter.fromUIMessage(AIV5Adapter.toUIMessage(db));

    expect(roundTripped.content.parts?.map(part => part.type)).toEqual(['text', 'reasoning', 'error']);
    expect(errorPartsOf(roundTripped.content.parts)).toEqual([ERROR_PART]);
  });

  it('AIV6 preserves order and payload without shifting later parts', () => {
    const db = makeDbMessage([...PARTIAL_PARTS, ERROR_PART, { type: 'text', text: 'trailing text' }]);
    const roundTripped = AIV6Adapter.fromUIMessage(AIV6Adapter.toUIMessage(db));

    // AIV6Adapter.fromUIMessage pairs its v5-bridge output by index, so a part
    // dropped in the bridge would misalign every part after it.
    expect(roundTripped.content.parts?.map(part => part.type)).toEqual(['text', 'reasoning', 'error', 'text']);
    expect(errorPartsOf(roundTripped.content.parts)).toEqual([ERROR_PART]);
    expect(roundTripped.content.parts?.at(-1)).toMatchObject({ type: 'text', text: 'trailing text' });
  });

  it('AIV6 preserves an error-only record', () => {
    const db = makeDbMessage([ERROR_PART]);
    const roundTripped = AIV6Adapter.fromUIMessage(AIV6Adapter.toUIMessage(db));

    expect(errorPartsOf(roundTripped.content.parts)).toEqual([ERROR_PART]);
  });

  it('round-trips through MessageList UI accessors', () => {
    const messageList = makeList([...PARTIAL_PARTS, ERROR_PART]);

    for (const uiParts of [
      messageList.get.all.aiV4.ui().at(-1)?.parts,
      messageList.get.all.aiV5.ui().at(-1)?.parts,
      messageList.get.all.aiV6.ui().at(-1)?.parts,
      messageList.get.all.aiV7.ui().at(-1)?.parts,
    ]) {
      const errorParts = errorPartsOf(uiParts);
      expect(errorParts).toHaveLength(1);
      expect(errorParts[0]?.type).toBe('error');
      expect(errorParts[0]?.error).toEqual(ERROR_PART.error);
      expect(Object.keys(errorParts[0]?.error ?? {})).toEqual(['name', 'message']);
    }
  });
});

describe('provider prompts omit the error part', () => {
  it('AIV4 core/prompt/llmPrompt drop the error part but keep partial parts', () => {
    const messageList = makeList([...PARTIAL_PARTS, ERROR_PART]);

    for (const prompt of [
      messageList.get.all.aiV4.core(),
      messageList.get.all.aiV4.prompt(),
      messageList.get.all.aiV4.llmPrompt(),
    ]) {
      const text = promptText(prompt);
      expect(text).not.toContain('model exploded');
      expect(text).not.toContain('"error"');
      expect(text).toContain('partial answer');
    }
  });

  it('AIV5 model/prompt/llmPrompt drop the error part but keep partial parts', async () => {
    const messageList = makeList([...PARTIAL_PARTS, ERROR_PART]);

    const prompts = [
      messageList.get.all.aiV5.model(),
      messageList.get.all.aiV5.prompt(),
      await messageList.get.all.aiV5.llmPrompt({}),
    ];

    for (const prompt of prompts) {
      const text = promptText(prompt);
      expect(text).not.toContain('model exploded');
      expect(text).not.toContain('"type":"error"');
      expect(text).toContain('partial answer');
    }
  });

  it('AIV6 and AIV7 llmPrompt drop the error part but keep partial parts', async () => {
    const messageList = makeList([...PARTIAL_PARTS, ERROR_PART]);

    const v6 = await messageList.get.all.aiV6.llmPrompt({});
    const v7 = await messageList.get.all.aiV7.llmPrompt({});

    for (const prompt of [v6, v7]) {
      const text = promptText(prompt);
      expect(text).not.toContain('model exploded');
      expect(text).not.toContain('"type":"error"');
      expect(text).toContain('partial answer');
    }
  });

  it('drops an error-only assistant message from every provider prompt', async () => {
    const messageList = makeList([ERROR_PART]);

    const v4Core = messageList.get.all.aiV4.core();
    const v4Prompt = messageList.get.all.aiV4.prompt();
    const v4LlmPrompt = messageList.get.all.aiV4.llmPrompt();
    const v5Model = messageList.get.all.aiV5.model();
    const v5Prompt = messageList.get.all.aiV5.prompt();
    const v5LlmPrompt = await messageList.get.all.aiV5.llmPrompt({});
    const v6LlmPrompt = await messageList.get.all.aiV6.llmPrompt({});
    const v7LlmPrompt = await messageList.get.all.aiV7.llmPrompt({});

    for (const prompt of [v4Core, v4Prompt, v4LlmPrompt, v5Model, v5Prompt, v5LlmPrompt, v6LlmPrompt, v7LlmPrompt]) {
      const text = promptText(prompt);
      expect(text).not.toContain('model exploded');
      expect(text).not.toContain('"type":"error"');
      // The user turn still reaches the provider; only the empty assistant turn is dropped.
      expect(text).toContain('what is the weather?');
      expect((prompt as Array<{ role: string }>).filter(message => message.role === 'assistant')).toEqual([]);
    }
  });

  it('never stringifies the error into model-visible text', async () => {
    const messageList = makeList([ERROR_PART]);

    const v5Prompt = messageList.get.all.aiV5.prompt();
    const v4Prompt = messageList.get.all.aiV4.prompt();
    const v7Prompt = await messageList.get.all.aiV7.llmPrompt({});

    for (const prompt of [v5Prompt, v4Prompt, v7Prompt]) {
      const text = promptText(prompt);
      expect(text).not.toContain('APICallError');
      expect(text).not.toContain('model exploded');
    }
  });
});
