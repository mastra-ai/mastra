import type { Experimental_EvaluationModelV4 as EvaluationModelV4 } from '@ai-sdk/provider-v7';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Agent } from '../../agent';
import type { MastraDBMessage } from '../../agent/message-list';
import { TripWire } from '../../agent/trip-wire';
import { Classifier } from '../../classifier';
import { Mastra } from '../../mastra';
import type { ChunkType } from '../../stream';
import { ChunkFrom } from '../../stream';
import { ClassifierProcessor } from './classifier';

const safetyQuestions = {
  unsafe: { type: 'boolean', criteria: { true: 'Unsafe', false: 'Safe' } },
} as const;

function createModel(doEvaluate: EvaluationModelV4['doEvaluate']): EvaluationModelV4 {
  return {
    specificationVersion: 'v4',
    provider: 'test-provider',
    modelId: 'test-model',
    supportedQuestionTypes: ['choice', 'score', 'boolean'],
    doEvaluate,
  };
}

function unsafeModel(probability: number) {
  return createModel(
    vi.fn(async () => ({
      answers: { unsafe: { type: 'boolean' as const, probability } },
      usage: { inputTokens: 1, outputTokens: 1 },
      warnings: [],
    })),
  );
}

function message(id: string, text: string, role: 'user' | 'assistant' = 'user'): MastraDBMessage {
  return {
    id,
    role,
    content: { format: 2, parts: [{ type: 'text', text }] },
    createdAt: new Date(),
  };
}

function textDelta(text: string, id = 'text-1'): ChunkType {
  return { type: 'text-delta', payload: { text, id }, runId: 'run-1', from: ChunkFrom.AGENT };
}

function abortThatThrows() {
  return vi.fn((reason?: string) => {
    throw new TripWire(reason ?? 'aborted');
  }) as unknown as (reason?: string) => never;
}

const blockAbove = (threshold: number) =>
  ((answers: { unsafe: { probability: number } }) =>
    answers.unsafe.probability >= threshold
      ? { action: 'block' as const, reason: 'Content blocked by policy' }
      : { action: 'pass' as const }) as any;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ClassifierProcessor', () => {
  describe('processInput', () => {
    it('passes messages when decide returns pass', async () => {
      const processor = new ClassifierProcessor({
        classifier: new Classifier({ id: 'safety', model: unsafeModel(0.1), questions: safetyQuestions }),
        decide: blockAbove(0.5),
      });
      const abort = abortThatThrows();
      const messages = [message('1', 'hello')];

      const result = await processor.processInput({ messages, abort });

      expect(result).toEqual(messages);
      expect(abort).not.toHaveBeenCalled();
    });

    it('aborts with the caller-supplied reason only', async () => {
      const model = createModel(
        vi.fn(async () => ({
          answers: { unsafe: { type: 'boolean' as const, probability: 0.95 } },
          usage: { inputTokens: 1, outputTokens: 1 },
          warnings: [],
          providerMetadata: { test: { explanation: 'MODEL_GENERATED_TEXT' } },
        })),
      );
      const processor = new ClassifierProcessor({
        classifier: new Classifier({ id: 'safety', model, questions: safetyQuestions }),
        decide: blockAbove(0.5),
      });
      const abort = abortThatThrows();

      await expect(processor.processInput({ messages: [message('1', 'bad')], abort })).rejects.toThrow(TripWire);
      expect(abort).toHaveBeenCalledTimes(1);
      expect(abort).toHaveBeenCalledWith('Content blocked by policy');
      expect(String((abort as any).mock.calls[0][0])).not.toContain('MODEL_GENERATED_TEXT');
    });

    it('filters only the flagged message', async () => {
      const doEvaluate = vi
        .fn()
        .mockResolvedValueOnce({
          answers: { unsafe: { type: 'boolean', probability: 0.9 } },
          usage: { inputTokens: 1, outputTokens: 1 },
          warnings: [],
        })
        .mockResolvedValueOnce({
          answers: { unsafe: { type: 'boolean', probability: 0.1 } },
          usage: { inputTokens: 1, outputTokens: 1 },
          warnings: [],
        });
      const processor = new ClassifierProcessor({
        classifier: new Classifier({ id: 'safety', model: createModel(doEvaluate), questions: safetyQuestions }),
        decide: answers => (answers.unsafe.probability > 0.5 ? { action: 'filter' } : { action: 'pass' }),
      });

      const result = await processor.processInput({
        messages: [message('1', 'bad'), message('2', 'fine')],
        abort: abortThatThrows(),
      });

      expect(result.map(m => m.id)).toEqual(['2']);
    });

    it('evaluates only the last message when lastMessageOnly is set', async () => {
      const doEvaluate = vi.fn(async () => ({
        answers: { unsafe: { type: 'boolean' as const, probability: 0.1 } },
        usage: { inputTokens: 1, outputTokens: 1 },
        warnings: [],
      }));
      const processor = new ClassifierProcessor({
        classifier: new Classifier({ id: 'safety', model: createModel(doEvaluate), questions: safetyQuestions }),
        decide: () => ({ action: 'pass' }),
        lastMessageOnly: true,
      });

      await processor.processInput({
        messages: [message('1', 'first'), message('2', 'second'), message('3', 'third')],
        abort: abortThatThrows(),
      });

      expect(doEvaluate).toHaveBeenCalledTimes(1);
      expect(doEvaluate.mock.calls[0]![0].state).toBe('third');
    });

    it('skips messages with no text', async () => {
      const doEvaluate = vi.fn();
      const processor = new ClassifierProcessor({
        classifier: new Classifier({ id: 'safety', model: createModel(doEvaluate), questions: safetyQuestions }),
        decide: () => ({ action: 'block', reason: 'never' }),
      });
      const empty: MastraDBMessage = {
        id: 'e',
        role: 'user',
        content: { format: 2, parts: [{ type: 'step-start' }] },
        createdAt: new Date(),
      };

      const result = await processor.processInput({ messages: [empty], abort: abortThatThrows() });

      expect(result).toEqual([empty]);
      expect(doEvaluate).not.toHaveBeenCalled();
    });

    it('truncates state to maxInputLength', async () => {
      const doEvaluate = vi.fn(async () => ({
        answers: { unsafe: { type: 'boolean' as const, probability: 0.1 } },
        usage: { inputTokens: 1, outputTokens: 1 },
        warnings: [],
      }));
      const processor = new ClassifierProcessor({
        classifier: new Classifier({ id: 'safety', model: createModel(doEvaluate), questions: safetyQuestions }),
        decide: () => ({ action: 'pass' }),
        maxInputLength: 5,
      });

      await processor.processInput({ messages: [message('1', 'abcdefghij')], abort: abortThatThrows() });

      expect(doEvaluate.mock.calls[0]![0].state).toBe('abcde');
    });

    it('supplies per-processor questions when the classifier has none configured', async () => {
      const doEvaluate = vi.fn(async () => ({
        answers: { topic: { type: 'choice' as const, choice: 'billing' } },
        usage: { inputTokens: 1, outputTokens: 1 },
        warnings: [],
      }));
      const decide = vi.fn(() => ({ action: 'pass' as const }));
      const processor = new ClassifierProcessor({
        classifier: new Classifier({ id: 'router', model: createModel(doEvaluate) }),
        questions: { topic: { type: 'choice', criteria: { billing: 'Billing', other: 'Other' } } },
        decide,
      });

      await processor.processInput({ messages: [message('1', 'refund please')], abort: abortThatThrows() });

      expect(Object.keys(doEvaluate.mock.calls[0]![0].questions)).toEqual(['topic']);
      expect(decide).toHaveBeenCalledWith(
        { topic: { type: 'choice', choice: 'billing' } },
        expect.objectContaining({ phase: 'input' }),
      );
    });
  });

  describe('error handling', () => {
    it('allows content and warns when the classifier fails with errorStrategy warn', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const processor = new ClassifierProcessor({
        classifier: new Classifier({
          id: 'safety',
          model: createModel(vi.fn().mockRejectedValue(new Error('boom'))),
          questions: safetyQuestions,
        }),
        decide: () => ({ action: 'block', reason: 'should not run' }),
      });
      const abort = abortThatThrows();
      const messages = [message('1', 'text')];

      const result = await processor.processInput({ messages, abort });

      expect(result).toEqual(messages);
      expect(abort).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalled();
    });

    it('aborts when the classifier fails with errorStrategy strict', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const processor = new ClassifierProcessor({
        classifier: new Classifier({
          id: 'safety',
          model: createModel(vi.fn().mockRejectedValue(new Error('boom'))),
          questions: safetyQuestions,
        }),
        decide: () => ({ action: 'pass' }),
        errorStrategy: 'strict',
      });
      const abort = abortThatThrows();

      await expect(processor.processInput({ messages: [message('1', 'text')], abort })).rejects.toThrow(TripWire);
      expect(abort).toHaveBeenCalledWith('Classification failed because the classifier call failed');
    });

    it('rethrows TripWire errors thrown by abort inside decide', async () => {
      const processor = new ClassifierProcessor({
        classifier: new Classifier({ id: 'safety', model: unsafeModel(0.9), questions: safetyQuestions }),
        decide: blockAbove(0.5),
        errorStrategy: 'warn',
      });

      await expect(
        processor.processInput({ messages: [message('1', 'text')], abort: abortThatThrows() }),
      ).rejects.toBeInstanceOf(TripWire);
    });
  });

  describe('processOutputResult', () => {
    it('passes phase output to decide', async () => {
      const decide = vi.fn(() => ({ action: 'pass' as const }));
      const processor = new ClassifierProcessor({
        classifier: new Classifier({ id: 'safety', model: unsafeModel(0.1), questions: safetyQuestions }),
        decide,
      });

      await processor.processOutputResult({
        messages: [message('1', 'response', 'assistant')],
        abort: abortThatThrows(),
      });

      expect(decide).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ phase: 'output' }));
    });
  });

  describe('processOutputStream', () => {
    it('emits non-text chunks without classifying', async () => {
      const doEvaluate = vi.fn();
      const processor = new ClassifierProcessor({
        classifier: new Classifier({ id: 'safety', model: createModel(doEvaluate), questions: safetyQuestions }),
        decide: () => ({ action: 'filter' }),
      });
      const part: ChunkType = { type: 'text-start', payload: { id: 't' }, runId: 'r', from: ChunkFrom.AGENT };

      const result = await processor.processOutputStream({ part, streamParts: [part], state: {}, abort: abortThatThrows() });

      expect(result).toBe(part);
      expect(doEvaluate).not.toHaveBeenCalled();
    });

    it('returns null for filtered chunks', async () => {
      const processor = new ClassifierProcessor({
        classifier: new Classifier({ id: 'safety', model: unsafeModel(0.9), questions: safetyQuestions }),
        decide: answers => (answers.unsafe.probability > 0.5 ? { action: 'filter' } : { action: 'pass' }),
      });
      const part = textDelta('bad');

      const result = await processor.processOutputStream({ part, streamParts: [part], state: {}, abort: abortThatThrows() });

      expect(result).toBeNull();
    });

    it('aborts on block decisions in the stream phase', async () => {
      const decide = vi.fn(() => ({ action: 'block' as const, reason: 'Stream blocked' }));
      const processor = new ClassifierProcessor({
        classifier: new Classifier({ id: 'safety', model: unsafeModel(0.9), questions: safetyQuestions }),
        decide,
      });
      const abort = abortThatThrows();
      const part = textDelta('bad');

      await expect(processor.processOutputStream({ part, streamParts: [part], state: {}, abort })).rejects.toThrow(
        TripWire,
      );
      expect(abort).toHaveBeenCalledWith('Stream blocked');
      expect(decide).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ phase: 'stream' }));
    });

    it('uses chunkWindow to build context from preceding text chunks', async () => {
      const doEvaluate = vi.fn(async () => ({
        answers: { unsafe: { type: 'boolean' as const, probability: 0.1 } },
        usage: { inputTokens: 1, outputTokens: 1 },
        warnings: [],
      }));
      const processor = new ClassifierProcessor({
        classifier: new Classifier({ id: 'safety', model: createModel(doEvaluate), questions: safetyQuestions }),
        decide: () => ({ action: 'pass' }),
        chunkWindow: 2,
      });
      const streamParts = [textDelta('a '), textDelta('b '), textDelta('c')];

      await processor.processOutputStream({
        part: streamParts[2]!,
        streamParts,
        state: {},
        abort: abortThatThrows(),
      });

      expect(doEvaluate.mock.calls[0]![0].state).toBe('b c');
    });

    it('emits the chunk when classification fails with errorStrategy warn', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const processor = new ClassifierProcessor({
        classifier: new Classifier({
          id: 'safety',
          model: createModel(vi.fn().mockRejectedValue(new Error('boom'))),
          questions: safetyQuestions,
        }),
        decide: () => ({ action: 'filter' }),
      });
      const part = textDelta('text');

      const result = await processor.processOutputStream({ part, streamParts: [part], state: {}, abort: abortThatThrows() });

      expect(result).toBe(part);
    });
  });

  describe('registered classifier resolution', () => {
    it('resolves a classifier by id through Mastra', async () => {
      const doEvaluate = vi.fn(async () => ({
        answers: { unsafe: { type: 'boolean' as const, probability: 0.9 } },
        usage: { inputTokens: 1, outputTokens: 1 },
        warnings: [],
      }));
      const classifier = new Classifier({ id: 'safety', model: createModel(doEvaluate), questions: safetyQuestions });
      const processor = new ClassifierProcessor<typeof safetyQuestions>({
        classifier: 'safety',
        decide: blockAbove(0.5),
      });
      const mastra = new Mastra({ classifiers: { safety: classifier }, processors: { guard: processor } });
      expect(mastra.getProcessor('guard')).toBe(processor);
      const abort = abortThatThrows();

      await expect(processor.processInput({ messages: [message('1', 'bad')], abort })).rejects.toThrow(TripWire);
      expect(doEvaluate).toHaveBeenCalledTimes(1);
      expect(abort).toHaveBeenCalledWith('Content blocked by policy');
    });

    it('receives Mastra when two agents use processors with the same default id', async () => {
      const doEvaluate = vi.fn(async () => ({
        answers: { unsafe: { type: 'boolean' as const, probability: 0.9 } },
        usage: { inputTokens: 1, outputTokens: 1 },
        warnings: [],
      }));
      const classifier = new Classifier({ id: 'safety', model: createModel(doEvaluate), questions: safetyQuestions });
      const first = new ClassifierProcessor<typeof safetyQuestions>({ classifier: 'safety', decide: blockAbove(0.5) });
      const second = new ClassifierProcessor<typeof safetyQuestions>({ classifier: 'safety', decide: blockAbove(0.5) });
      const mastra = new Mastra({ classifiers: { safety: classifier } });
      mastra.addAgent(new Agent({ id: 'a', name: 'a', instructions: '', model: 'openai/gpt-4o', inputProcessors: [first] }));
      mastra.addAgent(new Agent({ id: 'b', name: 'b', instructions: '', model: 'openai/gpt-4o', inputProcessors: [second] }));

      // Both processors share the id 'classifier'; the second is deduped by mastra.addProcessor
      // but must still resolve the registered classifier.
      await expect(
        second.processInput({ messages: [message('1', 'bad')], abort: abortThatThrows() }),
      ).rejects.toThrow(TripWire);
      expect(doEvaluate).toHaveBeenCalledTimes(1);
    });

    it('fails when a string classifier is used without a Mastra instance', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const processor = new ClassifierProcessor({
        classifier: 'missing',
        decide: () => ({ action: 'pass' }),
        errorStrategy: 'strict',
      });
      const abort = abortThatThrows();

      await expect(processor.processInput({ messages: [message('1', 'text')], abort })).rejects.toThrow(TripWire);
      expect(warn.mock.calls[0]![1]).toMatchObject({ id: 'CLASSIFIER_PROCESSOR_MASTRA_NOT_REGISTERED' });
    });

    it('fails when the referenced classifier is not registered', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const processor = new ClassifierProcessor({
        classifier: 'missing',
        decide: () => ({ action: 'pass' }),
        errorStrategy: 'strict',
      });
      new Mastra({ processors: { guard: processor } });

      await expect(
        processor.processInput({ messages: [message('1', 'text')], abort: abortThatThrows() }),
      ).rejects.toThrow(TripWire);
      expect(warn.mock.calls[0]![1]).toMatchObject({ id: 'MASTRA_GET_CLASSIFIER_BY_ID_NOT_FOUND' });
    });
  });
});
