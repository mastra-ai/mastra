import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { MastraDBMessage } from '../../agent/message-list';
import { Classifier } from '../../classifier';
import { Mastra } from '../../mastra';
import { ModelRouterProcessor } from './model-router';

function userMessage(text: string): MastraDBMessage {
  return {
    id: 'm1',
    role: 'user',
    createdAt: new Date(),
    threadId: 't1',
    resourceId: 'r1',
    content: { format: 2, parts: [{ type: 'text', text }] },
  } as unknown as MastraDBMessage;
}

const mockEvaluationModel = {
  specificationVersion: 'v1',
  provider: 'mock',
  modelId: 'mock-evaluation-model',
  supportedQuestionTypes: ['choice', 'score', 'boolean'],
} as any;

/** A configured classifier whose evaluate() is stubbed, so tests stay deterministic. */
function stubClassifier(answers: Record<string, unknown>, id = 'triage') {
  const classifier = new Classifier({
    id,
    model: mockEvaluationModel,
    questions: {
      complexity: {
        type: 'choice',
        criteria: {
          trivial: 'Answerable in one sentence',
          complex: 'Needs multi-step reasoning',
        },
      },
      sensitive: {
        type: 'boolean',
        criteria: { true: 'Sensitive', false: 'Routine' },
      },
    },
  });

  const evaluate = vi.fn().mockResolvedValue({
    answers,
    usage: { totalTokens: 10 },
    warnings: [],
    response: { modelId: 'stub', timestamp: new Date() },
  });
  (classifier as any).evaluate = evaluate;
  return { classifier, evaluate };
}

async function route(processor: ModelRouterProcessor<any>, text: string, stepNumber = 0) {
  const state: Record<string, unknown> = {};
  await processor.processInput({
    messages: [userMessage(text)],
    systemMessages: [],
    state,
    abort: (() => {
      throw new Error('aborted');
    }) as never,
  } as any);
  return processor.processInputStep({ stepNumber, state } as any);
}

describe('ModelRouterProcessor', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warn.mockRestore();
  });

  describe('map form', () => {
    it('applies the mapped model when the classifier is confident', async () => {
      const { classifier } = stubClassifier({ complexity: { choice: 'trivial', probability: 0.9 } });
      const processor = new ModelRouterProcessor({
        classifier,
        question: 'complexity',
        models: { trivial: 'openai/gpt-4o-mini', complex: 'openai/gpt-4o' },
      });

      expect(await route(processor, 'what is 2+2')).toEqual({ model: 'openai/gpt-4o-mini' });
    });

    it('routes on the choice alone when no threshold is configured', async () => {
      // Not every evaluation model returns probabilities for choice questions.
      const { classifier } = stubClassifier({ complexity: { choice: 'trivial' } });
      const processor = new ModelRouterProcessor({
        classifier,
        question: 'complexity',
        models: { trivial: 'openai/gpt-4o-mini', complex: 'openai/gpt-4o' },
      });

      expect(await route(processor, 'what is 2+2')).toEqual({ model: 'openai/gpt-4o-mini' });
    });

    it('abstains when a threshold is set but the model returned no probability', async () => {
      // Fail closed: an unevaluatable threshold must not silently pass.
      const { classifier } = stubClassifier({ complexity: { choice: 'trivial' } });
      const processor = new ModelRouterProcessor({
        classifier,
        question: 'complexity',
        models: { trivial: 'openai/gpt-4o-mini', complex: 'openai/gpt-4o' },
        minProbability: 0.6,
      });

      expect(await route(processor, 'what is 2+2')).toEqual({});
    });

    it('abstains below the probability threshold, leaving the configured model', async () => {
      const { classifier } = stubClassifier({ complexity: { choice: 'trivial', probability: 0.4 } });
      const processor = new ModelRouterProcessor({
        classifier,
        question: 'complexity',
        models: { trivial: 'openai/gpt-4o-mini', complex: 'openai/gpt-4o' },
        minProbability: 0.6,
      });

      expect(await route(processor, 'ambiguous request')).toEqual({});
    });

    it('honours a custom threshold', async () => {
      const { classifier } = stubClassifier({ complexity: { choice: 'trivial', probability: 0.4 } });
      const processor = new ModelRouterProcessor({
        classifier,
        question: 'complexity',
        models: { trivial: 'openai/gpt-4o-mini', complex: 'openai/gpt-4o' },
        minProbability: 0.3,
      });

      expect(await route(processor, 'ambiguous request')).toEqual({ model: 'openai/gpt-4o-mini' });
    });
  });

  describe('select form', () => {
    it('lets the caller combine multiple questions', async () => {
      const { classifier } = stubClassifier({
        complexity: { choice: 'trivial', probability: 0.95 },
        sensitive: { probability: 0.8 },
      });
      const processor = new ModelRouterProcessor({
        classifier,
        select: ({ complexity, sensitive }: any) => {
          // Sensitive requests stay on the configured model even when trivial.
          if (sensitive.probability >= 0.3) return undefined;
          return complexity.choice === 'trivial' ? 'openai/gpt-4o-mini' : undefined;
        },
      });

      expect(await route(processor, 'reset my password and refund me')).toEqual({});
    });

    it('applies the selected model when policy allows', async () => {
      const { classifier } = stubClassifier({
        complexity: { choice: 'trivial', probability: 0.95 },
        sensitive: { probability: 0.05 },
      });
      const processor = new ModelRouterProcessor({
        classifier,
        select: ({ complexity, sensitive }: any) => {
          if (sensitive.probability >= 0.3) return undefined;
          return complexity.choice === 'trivial' ? 'openai/gpt-4o-mini' : undefined;
        },
      });

      expect(await route(processor, 'what time is it')).toEqual({ model: 'openai/gpt-4o-mini' });
    });
  });

  it('only swaps on step 0', async () => {
    const { classifier } = stubClassifier({ complexity: { choice: 'trivial', probability: 0.9 } });
    const processor = new ModelRouterProcessor({
      classifier,
      question: 'complexity',
      models: { trivial: 'openai/gpt-4o-mini', complex: 'openai/gpt-4o' },
    });

    expect(await route(processor, 'what is 2+2', 1)).toEqual({});
  });

  it('classifies once per request, not once per step', async () => {
    const { classifier, evaluate } = stubClassifier({ complexity: { choice: 'trivial', probability: 0.9 } });
    const processor = new ModelRouterProcessor({
      classifier,
      question: 'complexity',
      models: { trivial: 'openai/gpt-4o-mini', complex: 'openai/gpt-4o' },
    });

    const state: Record<string, unknown> = {};
    const args = { messages: [userMessage('hi')], systemMessages: [], state, abort: (() => {}) as never };
    await processor.processInput(args as any);
    await processor.processInput(args as any);

    expect(evaluate).toHaveBeenCalledTimes(1);
  });

  it('fails open when the classifier throws', async () => {
    const { classifier, evaluate } = stubClassifier({});
    evaluate.mockRejectedValue(new Error('provider down'));
    const processor = new ModelRouterProcessor({
      classifier,
      question: 'complexity',
      models: { trivial: 'openai/gpt-4o-mini', complex: 'openai/gpt-4o' },
    });

    expect(await route(processor, 'anything')).toEqual({});
    expect(warn).toHaveBeenCalled();
  });

  it('skips classification when there is no user text', async () => {
    const { classifier, evaluate } = stubClassifier({ complexity: { choice: 'trivial', probability: 0.9 } });
    const processor = new ModelRouterProcessor({
      classifier,
      question: 'complexity',
      models: { trivial: 'openai/gpt-4o-mini', complex: 'openai/gpt-4o' },
    });

    const state: Record<string, unknown> = {};
    await processor.processInput({ messages: [], systemMessages: [], state, abort: (() => {}) as never } as any);

    expect(evaluate).not.toHaveBeenCalled();
    expect(processor.processInputStep({ stepNumber: 0, state } as any)).toEqual({});
  });

  describe('validation', () => {
    it('rejects a model map that misses a criterion', () => {
      const { classifier } = stubClassifier({});
      expect(
        () =>
          new ModelRouterProcessor({
            classifier,
            question: 'complexity',
            models: { trivial: 'openai/gpt-4o-mini' },
          }),
      ).toThrow(/missing a model for criteria: complex/);
    });

    it('rejects a model map with criteria the question does not define', () => {
      const { classifier } = stubClassifier({});
      expect(
        () =>
          new ModelRouterProcessor({
            classifier,
            question: 'complexity',
            models: { trivial: 'a', complex: 'b', nonsense: 'c' },
          }),
      ).toThrow(/does not define: nonsense/);
    });

    it('rejects an unknown question', () => {
      const { classifier } = stubClassifier({});
      expect(
        () => new ModelRouterProcessor({ classifier, question: 'nope', models: { a: 'b' } }),
      ).toThrow(/does not define/);
    });

    it('rejects a non-choice question in the map form', () => {
      const { classifier } = stubClassifier({});
      expect(
        () => new ModelRouterProcessor({ classifier, question: 'sensitive', models: { true: 'a', false: 'b' } }),
      ).toThrow(/requires a choice question/);
    });

    it('rejects a classifier with no configured questions', () => {
      const bare = new Classifier({ id: 'bare', model: mockEvaluationModel });
      expect(
        () => new ModelRouterProcessor({ classifier: bare, question: 'complexity', models: { trivial: 'a' } }),
      ).toThrow(/questions configured in its constructor/);
    });
  });

  describe('registered classifier', () => {
    it('resolves a classifier id at run time', async () => {
      const { classifier } = stubClassifier({ complexity: { choice: 'complex', probability: 0.9 } }, 'triage');
      const processor = new ModelRouterProcessor({
        classifier: 'triage',
        question: 'complexity',
        models: { trivial: 'openai/gpt-4o-mini', complex: 'openai/gpt-4o' },
      });

      const mastra = new Mastra({ classifiers: { triage: classifier } });
      processor.__registerMastra(mastra);

      expect(await route(processor, 'design a migration plan')).toEqual({ model: 'openai/gpt-4o' });
    });

    it('fails open with a warning when the id is not registered', async () => {
      const processor = new ModelRouterProcessor({
        classifier: 'missing',
        question: 'complexity',
        models: { trivial: 'a', complex: 'b' },
      });
      processor.__registerMastra(new Mastra({}));

      expect(await route(processor, 'hello')).toEqual({});
      expect(warn).toHaveBeenCalled();
    });
  });
});
