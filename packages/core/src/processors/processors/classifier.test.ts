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
import type { ClassifierOnResult } from './classifier';

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

function unsafeResult(probability: number) {
  return {
    answers: { unsafe: { type: 'boolean' as const, probability } },
    usage: { inputTokens: 1, outputTokens: 1 },
    warnings: [],
  };
}

function unsafeModel(probability: number) {
  return createModel(vi.fn(async () => unsafeResult(probability)));
}

function safetyClassifier(model: EvaluationModelV4) {
  return new Classifier({ id: 'safety', model, questions: safetyQuestions });
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

const blockUnsafeAbove =
  (threshold: number, reason: string): ClassifierOnResult<typeof safetyQuestions> =>
  (answers, { abort }) => {
    if (answers.unsafe.probability >= threshold) abort(reason);
  };

const filterUnsafeAbove =
  (threshold: number): ClassifierOnResult<typeof safetyQuestions> =>
  (answers, { filter }) => {
    if (answers.unsafe.probability >= threshold) filter();
  };

const noop = () => {};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ClassifierProcessor', () => {
  describe('constructor', () => {
    it('rejects a classifier instance without configured questions', () => {
      expect(
        () =>
          new ClassifierProcessor({
            classifier: new Classifier({ id: 'bare', model: unsafeModel(0) }) as any,
            onResult: noop,
          }),
      ).toThrow(/configured questions/);
    });
  });

  describe('processInput', () => {
    it('passes messages when onResult does nothing', async () => {
      const processor = new ClassifierProcessor({
        classifier: safetyClassifier(unsafeModel(0.1)),
        onResult: blockUnsafeAbove(0.5, 'Content blocked by policy'),
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
          ...unsafeResult(0.95),
          providerMetadata: { test: { explanation: 'MODEL_GENERATED_TEXT' } },
        })),
      );
      const processor = new ClassifierProcessor({
        classifier: safetyClassifier(model),
        onResult: blockUnsafeAbove(0.5, 'Content blocked by policy'),
      });
      const abort = abortThatThrows();

      await expect(processor.processInput({ messages: [message('1', 'bad')], abort })).rejects.toThrow(TripWire);
      expect(abort).toHaveBeenCalledTimes(1);
      expect(abort).toHaveBeenCalledWith('Content blocked by policy');
      expect(String((abort as any).mock.calls[0][0])).not.toContain('MODEL_GENERATED_TEXT');
    });

    it('filters only the matched message', async () => {
      const doEvaluate = vi.fn().mockResolvedValueOnce(unsafeResult(0.9)).mockResolvedValueOnce(unsafeResult(0.1));
      const processor = new ClassifierProcessor({
        classifier: safetyClassifier(createModel(doEvaluate)),
        onResult: filterUnsafeAbove(0.5),
      });

      const result = await processor.processInput({
        messages: [message('1', 'bad'), message('2', 'fine')],
        abort: abortThatThrows(),
      });

      expect(result.map(m => m.id)).toEqual(['2']);
    });

    it('passes phase and the full result to `onResult`', async () => {
      const onResult = vi.fn();
      const processor = new ClassifierProcessor({
        classifier: safetyClassifier(unsafeModel(0.3)),
        onResult,
      });

      await processor.processInput({ messages: [message('1', 'hello')], abort: abortThatThrows() });

      expect(onResult).toHaveBeenCalledWith(
        { unsafe: { type: 'boolean', probability: 0.3 } },
        expect.objectContaining({
          phase: 'input',
          result: expect.objectContaining({ answers: { unsafe: { type: 'boolean', probability: 0.3 } } }),
          abort: expect.any(Function),
          filter: expect.any(Function),
        }),
      );
    });

    it('supports an async onResult', async () => {
      const processor = new ClassifierProcessor({
        classifier: safetyClassifier(unsafeModel(0.9)),
        onResult: async (a, { abort }) => {
          if (a.unsafe.probability > 0.5) abort('Async blocked');
        },
      });
      const abort = abortThatThrows();

      await expect(processor.processInput({ messages: [message('1', 'bad')], abort })).rejects.toThrow(TripWire);
      expect(abort).toHaveBeenCalledWith('Async blocked');
    });

    it('evaluates only the last message when lastMessageOnly is set', async () => {
      const doEvaluate = vi.fn(async () => unsafeResult(0.1));
      const processor = new ClassifierProcessor({
        classifier: safetyClassifier(createModel(doEvaluate)),
        onResult: noop,
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
        classifier: safetyClassifier(createModel(doEvaluate)),
        onResult: noop,
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
      const doEvaluate = vi.fn(async () => unsafeResult(0.1));
      const processor = new ClassifierProcessor({
        classifier: safetyClassifier(createModel(doEvaluate)),
        onResult: noop,
        maxInputLength: 5,
      });

      await processor.processInput({ messages: [message('1', 'abcdefghij')], abort: abortThatThrows() });

      expect(doEvaluate.mock.calls[0]![0].state).toBe('abcde');
    });
  });

  describe('error handling', () => {
    it('allows content and warns when the classifier fails with errorStrategy warn', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const onResult = vi.fn();
      const processor = new ClassifierProcessor({
        classifier: safetyClassifier(createModel(vi.fn().mockRejectedValue(new Error('boom')))),
        onResult,
      });
      const abort = abortThatThrows();
      const messages = [message('1', 'text')];

      const result = await processor.processInput({ messages, abort });

      expect(result).toEqual(messages);
      expect(abort).not.toHaveBeenCalled();
      expect(onResult).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalled();
    });

    it('aborts when the classifier fails with errorStrategy strict', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const processor = new ClassifierProcessor({
        classifier: safetyClassifier(createModel(vi.fn().mockRejectedValue(new Error('boom')))),
        onResult: noop,
        errorStrategy: 'strict',
      });
      const abort = abortThatThrows();

      await expect(processor.processInput({ messages: [message('1', 'text')], abort })).rejects.toThrow(TripWire);
      expect(abort).toHaveBeenCalledWith('Classification failed because the classifier call failed');
    });

    it('rethrows TripWire errors thrown by abort', async () => {
      const processor = new ClassifierProcessor({
        classifier: safetyClassifier(unsafeModel(0.9)),
        onResult: blockUnsafeAbove(0.5, 'blocked'),
        errorStrategy: 'warn',
      });

      await expect(
        processor.processInput({ messages: [message('1', 'text')], abort: abortThatThrows() }),
      ).rejects.toBeInstanceOf(TripWire);
    });
  });

  describe('processOutputResult', () => {
    it('filters assistant messages', async () => {
      const processor = new ClassifierProcessor({
        classifier: safetyClassifier(unsafeModel(0.9)),
        onResult: filterUnsafeAbove(0.5),
      });

      const result = await processor.processOutputResult({
        messages: [message('1', 'response', 'assistant')],
        abort: abortThatThrows(),
      });

      expect(result).toEqual([]);
    });
  });

  describe('processOutputStream', () => {
    it('emits non-text chunks without classifying', async () => {
      const doEvaluate = vi.fn();
      const processor = new ClassifierProcessor({
        classifier: safetyClassifier(createModel(doEvaluate)),
        onResult: noop,
      });
      const part: ChunkType = { type: 'text-start', payload: { id: 't' }, runId: 'r', from: ChunkFrom.AGENT };

      const result = await processor.processOutputStream({
        part,
        streamParts: [part],
        state: {},
        abort: abortThatThrows(),
      });

      expect(result).toBe(part);
      expect(doEvaluate).not.toHaveBeenCalled();
    });

    it('returns null for filtered chunks', async () => {
      const processor = new ClassifierProcessor({
        classifier: safetyClassifier(unsafeModel(0.9)),
        onResult: filterUnsafeAbove(0.5),
      });
      const part = textDelta('bad');

      const result = await processor.processOutputStream({
        part,
        streamParts: [part],
        state: {},
        abort: abortThatThrows(),
      });

      expect(result).toBeNull();
    });

    it('aborts on block in the stream phase', async () => {
      const processor = new ClassifierProcessor({
        classifier: safetyClassifier(unsafeModel(0.9)),
        onResult: blockUnsafeAbove(0.5, 'Stream blocked'),
      });
      const abort = abortThatThrows();
      const part = textDelta('bad');

      await expect(processor.processOutputStream({ part, streamParts: [part], state: {}, abort })).rejects.toThrow(
        TripWire,
      );
      expect(abort).toHaveBeenCalledWith('Stream blocked');
    });

    it('uses chunkWindow to build context from preceding text chunks', async () => {
      const doEvaluate = vi.fn(async () => unsafeResult(0.1));
      const processor = new ClassifierProcessor({
        classifier: safetyClassifier(createModel(doEvaluate)),
        onResult: noop,
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
        classifier: safetyClassifier(createModel(vi.fn().mockRejectedValue(new Error('boom')))),
        onResult: noop,
      });
      const part = textDelta('text');

      const result = await processor.processOutputStream({
        part,
        streamParts: [part],
        state: {},
        abort: abortThatThrows(),
      });

      expect(result).toBe(part);
    });
  });

  describe('registered classifier resolution', () => {
    it('resolves a classifier by id through Mastra', async () => {
      const doEvaluate = vi.fn(async () => unsafeResult(0.9));
      const classifier = safetyClassifier(createModel(doEvaluate));
      const processor = new ClassifierProcessor<typeof safetyQuestions>({
        classifier: 'safety',
        onResult: blockUnsafeAbove(0.5, 'Content blocked by policy'),
      });
      const mastra = new Mastra({ classifiers: { safety: classifier }, processors: { guard: processor } });
      expect(mastra.getProcessor('guard')).toBe(processor);
      const abort = abortThatThrows();

      await expect(processor.processInput({ messages: [message('1', 'bad')], abort })).rejects.toThrow(TripWire);
      expect(doEvaluate).toHaveBeenCalledTimes(1);
      expect(abort).toHaveBeenCalledWith('Content blocked by policy');
    });

    it('receives Mastra when two agents use processors with the same default id', async () => {
      const doEvaluate = vi.fn(async () => unsafeResult(0.9));
      const classifier = safetyClassifier(createModel(doEvaluate));
      const opts = { classifier: 'safety', onResult: blockUnsafeAbove(0.5, 'blocked') } as const;
      const first = new ClassifierProcessor<typeof safetyQuestions>(opts);
      const second = new ClassifierProcessor<typeof safetyQuestions>(opts);
      const mastra = new Mastra({ classifiers: { safety: classifier } });
      mastra.addAgent(
        new Agent({ id: 'a', name: 'a', instructions: '', model: 'openai/gpt-4o', inputProcessors: [first] }),
      );
      mastra.addAgent(
        new Agent({ id: 'b', name: 'b', instructions: '', model: 'openai/gpt-4o', inputProcessors: [second] }),
      );

      // Both processors share the id 'classifier'; the second is deduped by mastra.addProcessor
      // but must still resolve the registered classifier.
      await expect(second.processInput({ messages: [message('1', 'bad')], abort: abortThatThrows() })).rejects.toThrow(
        TripWire,
      );
      expect(doEvaluate).toHaveBeenCalledTimes(1);
    });

    it('fails when a string classifier is used without a Mastra instance', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const processor = new ClassifierProcessor({
        classifier: 'missing',
        onResult: noop,
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
        onResult: noop,
        errorStrategy: 'strict',
      });
      new Mastra({ processors: { guard: processor } });

      await expect(
        processor.processInput({ messages: [message('1', 'text')], abort: abortThatThrows() }),
      ).rejects.toThrow(TripWire);
      expect(warn.mock.calls[0]![1]).toMatchObject({ id: 'MASTRA_GET_CLASSIFIER_BY_ID_NOT_FOUND' });
    });

    it('fails when the registered classifier has no configured questions', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const processor = new ClassifierProcessor({
        classifier: 'bare',
        onResult: noop,
        errorStrategy: 'strict',
      });
      new Mastra({
        classifiers: { bare: new Classifier({ id: 'bare', model: unsafeModel(0) }) },
        processors: { guard: processor },
      });

      await expect(
        processor.processInput({ messages: [message('1', 'text')], abort: abortThatThrows() }),
      ).rejects.toThrow(TripWire);
      expect(warn.mock.calls[0]![1]).toMatchObject({ id: 'CLASSIFIER_PROCESSOR_QUESTIONS_REQUIRED' });
    });
  });
});
