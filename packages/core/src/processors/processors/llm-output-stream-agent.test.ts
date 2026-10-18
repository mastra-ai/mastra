import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../../agent/agent';
import { ModerationProcessor } from './moderation';
import { SystemPromptScrubber } from './system-prompt-scrubber';

const words = 'The quick brown fox jumps over the lazy dog. It then runs into the forest and sleeps until morning.'
  .split(' ')
  .map((word, index) => (index === 0 ? word : ` ${word}`));
const fullText = words.join('');

function streamingModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'response-1', modelId: 'mock', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        ...words.map(delta => ({ type: 'text-delta' as const, id: 'text-1', delta })),
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ]),
    }),
  });
}

function lastUserText(prompt: Array<{ role: string; content: unknown }>): string {
  const user = [...prompt].reverse().find(message => message.role === 'user');
  const content = user?.content as Array<{ type: string; text?: string }> | undefined;
  return content?.map(part => part.text ?? '').join('') ?? '';
}

function countingDetector(result: unknown | ((text: string) => unknown)) {
  const inputs: string[] = [];
  const model = new MockLanguageModelV1({
    defaultObjectGenerationMode: 'json',
    doGenerate: async ({ prompt }) => {
      const text = lastUserText(prompt as Array<{ role: string; content: unknown }>);
      inputs.push(text);
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { promptTokens: 1, completionTokens: 1 },
        text: JSON.stringify(typeof result === 'function' ? result(text) : result),
      };
    },
  });
  return { model, inputs };
}

async function streamText(agent: Agent) {
  const output = await agent.stream('hi');
  let text = '';
  for await (const chunk of output.textStream) text += chunk;
  return text;
}

const cleanScrub = { detections: null, redacted_content: null, reason: null };
const cleanModeration = { category_scores: null, reason: null };

describe('LLM-backed output processors in agent.stream (#13644)', () => {
  it('SystemPromptScrubber does not call its detector once per text-delta by default', async () => {
    const detector = countingDetector(cleanScrub);
    const agent = new Agent({
      id: 'scrubber-agent',
      name: 'scrubber-agent',
      instructions: 'You are helpful.',
      model: streamingModel(),
      outputProcessors: [new SystemPromptScrubber({ model: detector.model })],
    });

    const text = await streamText(agent);

    expect(text).toBe(fullText);
    expect(detector.inputs.length).toBeLessThanOrEqual(3);
  });

  it('ModerationProcessor does not call its moderator once per text-delta by default', async () => {
    const moderator = countingDetector(cleanModeration);
    const agent = new Agent({
      id: 'moderation-agent',
      name: 'moderation-agent',
      instructions: 'You are helpful.',
      model: streamingModel(),
      outputProcessors: [new ModerationProcessor({ model: moderator.model })],
    });

    const text = await streamText(agent);

    expect(text).toBe(fullText);
    expect(moderator.inputs.length).toBeLessThanOrEqual(3);
  });

  it('checks once per buffered sentence', async () => {
    const buffered = countingDetector(cleanScrub);
    const agent = new Agent({
      id: 'buffer-size-agent',
      name: 'buffer-size-agent',
      instructions: 'You are helpful.',
      model: streamingModel(),
      outputProcessors: [new SystemPromptScrubber({ model: buffered.model })],
    });

    const text = await streamText(agent);

    expect(text).toBe(fullText);
    expect(buffered.inputs).toEqual([
      'The quick brown fox jumps over the lazy dog.',
      ' It then runs into the forest and sleeps until morning.',
      // processOutputResult still checks the final message once.
      fullText,
    ]);
  });

  it.each([
    [
      'SystemPromptScrubber',
      (model: MockLanguageModelV1) => new SystemPromptScrubber({ model, bufferSize: 0 }),
      cleanScrub,
    ],
    [
      'ModerationProcessor',
      (model: MockLanguageModelV1) => new ModerationProcessor({ model, bufferSize: 0 }),
      cleanModeration,
    ],
  ] as const)('%s restores one check per text-delta with bufferSize: 0', async (_name, create, clean) => {
    const detector = countingDetector(clean);
    const agent = new Agent({
      id: 'per-chunk-agent',
      name: 'per-chunk-agent',
      instructions: 'You are helpful.',
      model: streamingModel(),
      outputProcessors: [create(detector.model)],
    });

    const text = await streamText(agent);

    expect(text).toBe(fullText);
    // One check per text-delta, plus processOutputResult checking the final message.
    expect(detector.inputs.length).toBe(words.length + 1);
  });

  it('SystemPromptScrubber still redacts leaked prompt text before it reaches the stream', async () => {
    const leak = 'lazy dog';
    const detector = countingDetector((text: string) => {
      const start = text.indexOf(leak);
      if (start === -1) return cleanScrub;
      return {
        detections: [
          {
            type: 'system_prompt',
            value: leak,
            confidence: 0.9,
            start,
            end: start + leak.length,
            redacted_value: null,
          },
        ],
        redacted_content: null,
        reason: 'leak',
      };
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const agent = new Agent({
      id: 'scrubber-redact-agent',
      name: 'scrubber-redact-agent',
      instructions: 'You are helpful.',
      model: streamingModel(),
      outputProcessors: [new SystemPromptScrubber({ model: detector.model, redactionMethod: 'placeholder' })],
    });

    const text = await streamText(agent);

    expect(text).not.toContain('lazy dog');
    expect(text).toContain('[SYSTEM_PROMPT]');
  });

  it('ModerationProcessor still blocks flagged streamed content', async () => {
    const moderator = countingDetector({ category_scores: [{ category: 'violence', score: 0.9 }], reason: 'bad' });
    const agent = new Agent({
      id: 'moderation-block-agent',
      name: 'moderation-block-agent',
      instructions: 'You are helpful.',
      model: streamingModel(),
      outputProcessors: [new ModerationProcessor({ model: moderator.model })],
    });

    const output = await agent.stream('hi');
    let text = '';
    for await (const chunk of output.textStream) text += chunk;

    expect(text).not.toContain('lazy dog');
    expect(output.tripwire).toBeTruthy();
  });
});

describe('LLM stream buffering without a stream writer', () => {
  it('emits every part when text is followed by text-end and finish', async () => {
    const detector = countingDetector(cleanScrub);
    const scrubber = new SystemPromptScrubber({ model: detector.model });
    const state: Record<string, unknown> = {};
    const parts = [
      { type: 'text-delta', payload: { id: 'text-1', text: 'Hello' }, runId: 'run-1', from: 'AGENT' },
      { type: 'text-end', payload: { id: 'text-1' }, runId: 'run-1', from: 'AGENT' },
      { type: 'finish', payload: {}, runId: 'run-1', from: 'AGENT' },
    ] as any[];

    const emitted = [];
    for (const part of parts) {
      emitted.push(await scrubber.processOutputStream({ part, streamParts: [], state, abort: vi.fn() as any } as any));
    }

    expect(emitted.map(part => part?.type)).toEqual(['text-delta', 'text-end', 'finish']);
    expect(emitted[0]?.payload.text).toBe('Hello');
  });
});
