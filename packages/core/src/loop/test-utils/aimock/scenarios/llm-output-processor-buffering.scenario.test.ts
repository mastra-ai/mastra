import { createOpenAI } from '@ai-sdk/openai-v5';
import type { JournalEntry, LLMock } from '@copilotkit/aimock';
import { describe, expect, it, vi } from 'vitest';
import { ModerationProcessor } from '../../../../processors/processors/moderation';
import { SystemPromptScrubber } from '../../../../processors/processors/system-prompt-scrubber';
import type { ChunkType } from '../../../../stream/types';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

/**
 * Story: a support agent streams its reply through LLM-backed guardrails — a SystemPromptScrubber
 * that hides leaked instructions and a ModerationProcessor that blocks harmful text. Each guardrail
 * asks its own model whether the streamed text is safe.
 *
 * Bug #13644: both guardrails asked their model once per streamed text-delta, so a 200-token reply
 * made ~200 sequential guardrail calls and streamed at a few characters per second. With
 * `bufferSize` set (e.g. 200) they buffer streamed text and check it once per sentence (or every
 * `bufferSize` characters). Buffering is opt-in: the default stays per-chunk until v2.
 */

const AGENT_INSTRUCTIONS = 'You are a helpful support agent.';
const SCRUBBER_PROMPT = 'You are a system prompt detection agent.';
const MODERATOR_PROMPT = 'You are a content moderation specialist.';

const FIRST_SENTENCE = 'The quick brown fox jumps over the lazy dog.';
const SECOND_SENTENCE = ' It then runs into the forest and sleeps until morning.';
const REPLY = FIRST_SENTENCE + SECOND_SENTENCE;
// Small chunks so the reply streams as ~20 text-deltas, like a real token stream.
const TOKEN_STREAM = { chunkSize: 5 };

const CLEAN_SCRUB = { detections: null, redacted_content: null, reason: null };
const CLEAN_MODERATION = { category_scores: null, reason: null };

function guardrailModel(llm: LLMock) {
  return createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` })(SCENARIO_MODEL_ID);
}

function messageText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map(part => (part as { text?: string }).text ?? '').join('');
  return '';
}

/** The moderator wraps the text it checks in a prompt; the scrubber sends the text as-is. */
function checkedText(prompt: string): string {
  return /Content: "([\s\S]*)"$/.exec(prompt)?.[1] ?? prompt;
}

/** The text each guardrail model call was asked to check, read from the AIMock request journal. */
function guardrailInputs(requests: JournalEntry[], systemPrompt: string): string[] {
  return requests
    .filter(entry =>
      entry.body?.messages.some(m => m.role === 'system' && messageText(m.content).includes(systemPrompt)),
    )
    .map(entry => checkedText(messageText(entry.body!.messages.filter(m => m.role === 'user').at(-1)?.content)));
}

function scriptReply(llm: LLMock) {
  llm.on({ endpoint: 'chat', systemMessage: AGENT_INSTRUCTIONS }, { content: REPLY }, TOKEN_STREAM);
}

function scriptCleanGuardrails(llm: LLMock) {
  llm.on({ endpoint: 'chat', systemMessage: SCRUBBER_PROMPT }, { content: CLEAN_SCRUB });
  llm.on({ endpoint: 'chat', systemMessage: MODERATOR_PROMPT }, { content: CLEAN_MODERATION });
}

const streamedText = (chunks: ChunkType[] = []) =>
  chunks.map(chunk => (chunk.type === 'text-delta' ? chunk.payload.text : '')).join('');
const textDeltaCount = (chunks: ChunkType[] = []) => chunks.filter(chunk => chunk.type === 'text-delta').length;

describeForAllEngines('Support agent with LLM-backed output guardrails (#13644)', engine => {
  const getMock = useLoopScenarioAimock();

  it.each([
    [
      'SystemPromptScrubber',
      SCRUBBER_PROMPT,
      (llm: LLMock) => new SystemPromptScrubber({ model: guardrailModel(llm), bufferSize: 200 }),
    ],
    [
      'ModerationProcessor',
      MODERATOR_PROMPT,
      (llm: LLMock) => new ModerationProcessor({ model: guardrailModel(llm), bufferSize: 200 }),
    ],
  ])(
    '%s with bufferSize: 200 checks the streamed reply once per sentence, not once per chunk',
    async (name, systemPrompt, create) => {
      const llm = getMock();
      const { output, requests } = await runLoopScenario({
        engine,
        llm,
        prompt: 'Tell me a short story.',
        instructions: AGENT_INSTRUCTIONS,
        outputProcessors: [create(llm)],
        fixtures: llm => {
          scriptCleanGuardrails(llm);
          scriptReply(llm);
        },
      });

      expect(await output.text).toBe(REPLY);
      expect(
        guardrailInputs(requests, systemPrompt).map(text => text.trim()),
        `${name} must call its model once per sentence plus once for the final message, not once per streamed chunk (#13644)`,
      ).toEqual([FIRST_SENTENCE.trim(), SECOND_SENTENCE.trim(), REPLY]);
    },
  );

  it.each([
    [
      'SystemPromptScrubber',
      SCRUBBER_PROMPT,
      (llm: LLMock) => new SystemPromptScrubber({ model: guardrailModel(llm) }),
    ],
    ['ModerationProcessor', MODERATOR_PROMPT, (llm: LLMock) => new ModerationProcessor({ model: guardrailModel(llm) })],
  ])('%s by default still checks every streamed chunk (buffering is opt-in)', async (name, systemPrompt, create) => {
    const llm = getMock();
    const { output, requests, chunks } = await runLoopScenario({
      engine,
      llm,
      prompt: 'Tell me a short story.',
      instructions: AGENT_INSTRUCTIONS,
      outputProcessors: [create(llm)],
      collectChunks: true,
      fixtures: llm => {
        scriptCleanGuardrails(llm);
        scriptReply(llm);
      },
    });

    expect(await output.text).toBe(REPLY);
    expect(textDeltaCount(chunks)).toBeGreaterThan(10);
    // The call count is the behaviour under test: one call per streamed chunk plus the final message.
    expect(
      guardrailInputs(requests, systemPrompt),
      `${name} must keep per-chunk checks unless bufferSize is set; buffering is opt-in until v2`,
    ).toHaveLength(textDeltaCount(chunks) + 1);
  });

  it('SystemPromptScrubber with bufferSize: 200 hides leaked instructions even when they arrive split across chunks', async () => {
    const leak = 'lazy dog';
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const llm = getMock();
    const { chunks } = await runLoopScenario({
      engine,
      llm,
      prompt: 'Tell me a short story.',
      instructions: AGENT_INSTRUCTIONS,
      outputProcessors: [
        new SystemPromptScrubber({ model: guardrailModel(llm), redactionMethod: 'placeholder', bufferSize: 200 }),
      ],
      collectChunks: true,
      fixtures: llm => {
        llm.on({ endpoint: 'chat', systemMessage: SCRUBBER_PROMPT }, req => {
          const text = messageText(req.messages.filter(m => m.role === 'user').at(-1)?.content);
          const start = text.indexOf(leak);
          if (start === -1) return { content: CLEAN_SCRUB };
          const detection = { type: 'system_prompt', value: leak, confidence: 0.9, start, end: start + leak.length };
          return {
            content: { detections: [{ ...detection, redacted_value: null }], redacted_content: null, reason: 'leak' },
          };
        });
        scriptReply(llm);
      },
    });

    // Assert on what streamed to the user, not output.text, which processOutputResult rewrites afterwards.
    const text = streamedText(chunks);
    expect(text, 'leaked instructions were streamed to the user').not.toContain(leak);
    expect(text).toContain('[SYSTEM_PROMPT]');
  });
});

describe('SystemPromptScrubber streaming without a stream writer', () => {
  const getMock = useLoopScenarioAimock();

  // Processors can be driven directly (no runner, so no writer to re-drive held parts). Buffering
  // must not swallow the parts that follow the text.
  it('emits every part when text is followed by text-end and finish', async () => {
    const llm = getMock();
    scriptCleanGuardrails(llm);
    const scrubber = new SystemPromptScrubber({ model: guardrailModel(llm), bufferSize: 200 });
    const state: Record<string, unknown> = {};
    const parts = [
      { type: 'text-delta', payload: { id: 'text-1', text: 'Hello' }, runId: 'run-1', from: 'AGENT' },
      { type: 'text-end', payload: { id: 'text-1' }, runId: 'run-1', from: 'AGENT' },
      { type: 'finish', payload: {}, runId: 'run-1', from: 'AGENT' },
    ] as ChunkType[];

    const emitted: Array<ChunkType | null | undefined> = [];
    for (const part of parts) {
      emitted.push(
        await scrubber.processOutputStream({
          part,
          streamParts: [],
          state,
          abort: (() => {
            throw new Error('aborted');
          }) as never,
        } as Parameters<SystemPromptScrubber['processOutputStream']>[0]),
      );
    }

    expect(
      emitted.map(part => part?.type),
      'parts after the buffered text were dropped',
    ).toEqual(['text-delta', 'text-end', 'finish']);
    expect((emitted[0] as { payload: { text: string } }).payload.text).toBe('Hello');
  });
});
