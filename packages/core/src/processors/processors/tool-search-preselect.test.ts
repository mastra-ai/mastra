import type { Experimental_EvaluationModelV4 as EvaluationModelV4 } from '@ai-sdk/provider-v7';
import { describe, it, expect, vi } from 'vitest';

import { MessageList } from '../../agent/message-list';
import { Classifier } from '../../classifier';
import { RequestContext, MASTRA_THREAD_ID_KEY } from '../../request-context';
import { createTool } from '../../tools';
import type { Tool } from '../../tools';
import type { ProcessInputStepArgs } from '../index';
import { ToolSearchProcessor } from './tool-search';
import type { ToolPreselectDecision } from './tool-search';

const routerQuestions = {
  domain: {
    type: 'choice',
    instructions: 'Which capability does this request need?',
    criteria: {
      github: 'Issues, pull requests, repositories',
      email: 'Sending or reading mail',
      none: 'Conversational; needs no tools',
    },
  },
} as const;

const preselectTools = {
  github: ['createIssue', 'listIssues'],
  email: ['sendEmail'],
  none: [],
};

function createTools(): Record<string, Tool<any, any>> {
  const tool = (id: string, description: string) =>
    createTool({ id, description, execute: async () => ({ ok: true }) });
  return {
    createIssue: tool('createIssue', 'Create a GitHub issue'),
    listIssues: tool('listIssues', 'List GitHub issues'),
    sendEmail: tool('sendEmail', 'Send an email'),
    getWeather: tool('getWeather', 'Get the weather'),
  };
}

/** Evaluation model returning a fixed choice answer. */
type ChoiceAnswer = { choice: string; probabilities?: Record<string, number> };

function createModel(answer: ChoiceAnswer | ChoiceAnswer[] | Error) {
  let call = 0;
  const doEvaluate = vi.fn(async () => {
    if (answer instanceof Error) throw answer;
    const next = Array.isArray(answer) ? (answer[call] ?? answer[answer.length - 1]!) : answer;
    call += 1;
    return {
      answers: { domain: { type: 'choice' as const, ...next } },
      usage: { inputTokens: 8, outputTokens: 2 },
      warnings: [],
    };
  });
  const model: EvaluationModelV4 = {
    specificationVersion: 'v4',
    provider: 'test-provider',
    modelId: 'test-model',
    supportedQuestionTypes: ['choice', 'score', 'boolean'],
    doEvaluate: doEvaluate as unknown as EvaluationModelV4['doEvaluate'],
  };
  return { model, doEvaluate };
}

function createArgs(userText: string, threadId = 'thread-1'): ProcessInputStepArgs {
  const requestContext = new RequestContext();
  requestContext.set(MASTRA_THREAD_ID_KEY, threadId);
  const messageList = new MessageList({});
  if (userText) {
    messageList.add({ role: 'user', content: userText }, 'user');
  }
  return { messageList, requestContext, tools: undefined };
}

/** Names of non-meta tools the model would see this step. */
function activeToolNames(result: { tools?: Record<string, unknown> }): string[] {
  return Object.keys(result.tools ?? {}).filter(name => name !== 'search_tools' && name !== 'load_tool');
}

describe('ToolSearchProcessor preselect', () => {
  describe('seeding', () => {
    it('loads the mapped tools on the first turn, before any model tool call', async () => {
      const { model, doEvaluate } = createModel({ choice: 'github', probabilities: { github: 0.9, email: 0.05, none: 0.05 } });
      const processor = new ToolSearchProcessor({
        tools: createTools(),
        preselect: {
          classifier: new Classifier({ id: 'router', model, questions: routerQuestions }),
          question: 'domain',
          tools: preselectTools,
        },
      });

      const result = await processor.processInputStep(createArgs('open an issue about the login bug'));

      // The discovery round-trip is gone: tools are present on the very first step.
      expect(activeToolNames(result).sort()).toEqual(['createIssue', 'listIssues']);
      expect(doEvaluate).toHaveBeenCalledTimes(1);
    });

    it('keeps the meta-tools available so the model can still correct the prior', async () => {
      const { model } = createModel({ choice: 'github', probabilities: { github: 0.9, email: 0.05, none: 0.05 } });
      const processor = new ToolSearchProcessor({
        tools: createTools(),
        preselect: {
          classifier: new Classifier({ id: 'router', model, questions: routerQuestions }),
          question: 'domain',
          tools: preselectTools,
        },
      });

      const result = await processor.processInputStep(createArgs('open an issue'));

      expect(Object.keys(result.tools ?? {})).toEqual(expect.arrayContaining(['search_tools', 'load_tool']));
    });

    it('never hides tools: an unrelated request still reaches everything through search', async () => {
      const { model } = createModel({ choice: 'email', probabilities: { github: 0.05, email: 0.9, none: 0.05 } });
      const processor = new ToolSearchProcessor({
        tools: createTools(),
        preselect: {
          classifier: new Classifier({ id: 'router', model, questions: routerQuestions }),
          question: 'domain',
          tools: preselectTools,
        },
      });

      // Wrong prior: seeds email tools for a weather request.
      const result = await processor.processInputStep(createArgs('what is the weather'));

      expect(activeToolNames(result)).toEqual(['sendEmail']);
      // getWeather was not removed from the catalog — search_tools can still find it.
      const found = await result.tools?.search_tools!.execute?.({ query: 'weather' } as any, undefined as any);
      expect(found.results.map((t: { name: string }) => t.name)).toContain('getWeather');
    });

    it('maps a "no tools needed" choice to an empty set', async () => {
      const { model } = createModel({ choice: 'none', probabilities: { github: 0.02, email: 0.03, none: 0.95 } });
      const processor = new ToolSearchProcessor({
        tools: createTools(),
        preselect: {
          classifier: new Classifier({ id: 'router', model, questions: routerQuestions }),
          question: 'domain',
          tools: preselectTools,
        },
      });

      const result = await processor.processInputStep(createArgs('hey, how are you?'));

      expect(activeToolNames(result)).toEqual([]);
    });
  });

  describe('abstention', () => {
    it('loads nothing when the top choice is below minProbability', async () => {
      const { model } = createModel({ choice: 'github', probabilities: { github: 0.4, email: 0.35, none: 0.25 } });
      const processor = new ToolSearchProcessor({
        tools: createTools(),
        preselect: {
          classifier: new Classifier({ id: 'router', model, questions: routerQuestions }),
          question: 'domain',
          tools: preselectTools,
        },
      });

      const result = await processor.processInputStep(createArgs('can you help with the thing'));

      expect(activeToolNames(result)).toEqual([]);
    });

    it('respects a custom minProbability', async () => {
      const { model } = createModel({ choice: 'github', probabilities: { github: 0.4, email: 0.35, none: 0.25 } });
      const processor = new ToolSearchProcessor({
        tools: createTools(),
        preselect: {
          classifier: new Classifier({ id: 'router', model, questions: routerQuestions }),
          question: 'domain',
          tools: preselectTools,
          minProbability: 0.3,
        },
      });

      const result = await processor.processInputStep(createArgs('open an issue'));

      expect(activeToolNames(result).sort()).toEqual(['createIssue', 'listIssues']);
    });

    it('uses the choice as-is when the provider returns no distribution', async () => {
      const { model } = createModel({ choice: 'email' });
      const processor = new ToolSearchProcessor({
        tools: createTools(),
        preselect: {
          classifier: new Classifier({ id: 'router', model, questions: routerQuestions }),
          question: 'domain',
          tools: preselectTools,
        },
      });

      const result = await processor.processInputStep(createArgs('email the team'));

      expect(activeToolNames(result)).toEqual(['sendEmail']);
    });
  });

  describe('gating', () => {
    it('runs once per user message, not once per step', async () => {
      const { model, doEvaluate } = createModel({ choice: 'github', probabilities: { github: 0.9, email: 0.05, none: 0.05 } });
      const processor = new ToolSearchProcessor({
        tools: createTools(),
        preselect: {
          classifier: new Classifier({ id: 'router', model, questions: routerQuestions }),
          question: 'domain',
          tools: preselectTools,
        },
      });

      // Three steps of one turn: same user message each time.
      await processor.processInputStep(createArgs('open an issue', 'thread-warm'));
      await processor.processInputStep(createArgs('open an issue', 'thread-warm'));
      await processor.processInputStep(createArgs('open an issue', 'thread-warm'));

      expect(doEvaluate).toHaveBeenCalledTimes(1);
    });

    it('re-runs when the user changes the subject, so stale tools are not reused', async () => {
      const { model, doEvaluate } = createModel([
        { choice: 'github', probabilities: { github: 0.9, email: 0.05, none: 0.05 } },
        { choice: 'email', probabilities: { github: 0.05, email: 0.9, none: 0.05 } },
      ]);
      const processor = new ToolSearchProcessor({
        tools: createTools(),
        preselect: {
          classifier: new Classifier({ id: 'router', model, questions: routerQuestions }),
          question: 'domain',
          tools: preselectTools,
        },
      });

      await processor.processInputStep(createArgs('open an issue', 'thread-topics'));
      const second = await processor.processInputStep(createArgs('actually, email the team instead', 'thread-topics'));

      expect(doEvaluate).toHaveBeenCalledTimes(2);
      // Additive: the github tools stay, the email tool is added.
      expect(activeToolNames(second).sort()).toEqual(['createIssue', 'listIssues', 'sendEmail']);
    });

    it('skips the classifier when there is no user text to classify', async () => {
      const { model, doEvaluate } = createModel({ choice: 'github', probabilities: { github: 0.9, email: 0.05, none: 0.05 } });
      const processor = new ToolSearchProcessor({
        tools: createTools(),
        preselect: {
          classifier: new Classifier({ id: 'router', model, questions: routerQuestions }),
          question: 'domain',
          tools: preselectTools,
        },
      });

      await processor.processInputStep(createArgs(''));

      expect(doEvaluate).not.toHaveBeenCalled();
    });

    it('does not run when preselect is not configured', async () => {
      const processor = new ToolSearchProcessor({ tools: createTools() });

      const result = await processor.processInputStep(createArgs('open an issue'));

      expect(activeToolNames(result)).toEqual([]);
    });
  });

  describe('filter hook', () => {
    it('does not seed tools the filter blocks for this request', async () => {
      const { model } = createModel({ choice: 'github', probabilities: { github: 0.9, email: 0.05, none: 0.05 } });
      const processor = new ToolSearchProcessor({
        tools: createTools(),
        filter: ({ toolName }) => toolName !== 'createIssue',
        preselect: {
          classifier: new Classifier({ id: 'router', model, questions: routerQuestions }),
          question: 'domain',
          tools: preselectTools,
        },
      });

      const result = await processor.processInputStep(createArgs('open an issue'));

      expect(activeToolNames(result)).toEqual(['listIssues']);
    });
  });

  describe('fail open', () => {
    it('falls back to the normal flow when the classifier throws', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { model } = createModel(new Error('evaluation model unavailable'));
      const processor = new ToolSearchProcessor({
        tools: createTools(),
        preselect: {
          classifier: new Classifier({ id: 'router', model, questions: routerQuestions, maxRetries: 0 }),
          question: 'domain',
          tools: preselectTools,
        },
      });

      const result = await processor.processInputStep(createArgs('open an issue'));

      // No throw, no tools seeded, meta-tools intact.
      expect(activeToolNames(result)).toEqual([]);
      expect(Object.keys(result.tools ?? {})).toEqual(expect.arrayContaining(['search_tools', 'load_tool']));
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  describe('construction-time validation', () => {
    const build = (preselect: any) => () =>
      new ToolSearchProcessor({ tools: createTools(), preselect });

    it('rejects a classifier without configured questions', () => {
      const { model } = createModel({ choice: 'github' });
      expect(
        build({ classifier: new Classifier({ id: 'router', model }), question: 'domain', tools: preselectTools }),
      ).toThrow(/configured questions/);
    });

    it('rejects a question that is not configured', () => {
      const { model } = createModel({ choice: 'github' });
      expect(
        build({
          classifier: new Classifier({ id: 'router', model, questions: routerQuestions }),
          question: 'missing',
          tools: preselectTools,
        }),
      ).toThrow(/not configured/);
    });

    it('rejects a non-choice question', () => {
      const { model } = createModel({ choice: 'github' });
      const classifier = new Classifier({
        id: 'router',
        model,
        questions: { urgent: { type: 'boolean', criteria: { true: 'Urgent', false: 'Not urgent' } } } as const,
      });
      expect(build({ classifier, question: 'urgent', tools: { yes: [] } })).toThrow(/choice question/);
    });

    it('rejects an incomplete choice mapping', () => {
      const { model } = createModel({ choice: 'github' });
      expect(
        build({
          classifier: new Classifier({ id: 'router', model, questions: routerQuestions }),
          question: 'domain',
          tools: { github: ['createIssue'], email: ['sendEmail'] },
        }),
      ).toThrow(/Missing: none/);
    });

    it('rejects a mapping with choices the question cannot return', () => {
      const { model } = createModel({ choice: 'github' });
      expect(
        build({
          classifier: new Classifier({ id: 'router', model, questions: routerQuestions }),
          question: 'domain',
          tools: { ...preselectTools, slack: ['sendEmail'] },
        }),
      ).toThrow(/cannot return: slack/);
    });
  });

  describe('onPreselect', () => {
    const buildWith = (answer: ChoiceAnswer | Error, overrides: Record<string, unknown> = {}) => {
      const { model } = createModel(answer);
      const decisions: ToolPreselectDecision[] = [];
      const processor = new ToolSearchProcessor({
        tools: createTools(),
        ...(overrides.filter ? { filter: overrides.filter as any } : {}),
        preselect: {
          classifier: new Classifier({ id: 'router', model, questions: routerQuestions, maxRetries: 0 }),
          question: 'domain',
          tools: preselectTools,
          onPreselect: decision => {
            decisions.push(decision);
          },
          ...overrides.preselect as object,
        },
      });
      return { processor, decisions };
    };

    it('reports the seeded tools and the confidence behind them', async () => {
      const { processor, decisions } = buildWith({
        choice: 'github',
        probabilities: { github: 0.9, email: 0.05, none: 0.05 },
      });

      await processor.processInputStep(createArgs('open an issue'));

      expect(decisions).toEqual([
        { tools: ['createIssue', 'listIssues'], choice: 'github', probability: 0.9, abstained: false },
      ]);
    });

    it('distinguishes a low-confidence abstention from a confident "no tools" answer', async () => {
      const unsure = buildWith({ choice: 'github', probabilities: { github: 0.4, email: 0.35, none: 0.25 } });
      await unsure.processor.processInputStep(createArgs('open an issue'));

      const noTools = buildWith({ choice: 'none', probabilities: { github: 0.02, email: 0.03, none: 0.95 } });
      await noTools.processor.processInputStep(createArgs('thanks, that is all'));

      // Both seed nothing, but only one of them is the classifier being unsure.
      expect(unsure.decisions[0]).toMatchObject({ abstained: true, reason: 'below-threshold', probability: 0.4 });
      expect(noTools.decisions[0]).toMatchObject({ abstained: true, reason: 'no-tools-for-choice', choice: 'none' });
    });

    it('reports a classifier outage rather than staying silent about it', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { processor, decisions } = buildWith(new Error('evaluation model unavailable'));

      await processor.processInputStep(createArgs('open an issue'));

      expect(decisions[0]).toEqual({ tools: [], abstained: true, reason: 'classifier-error' });
      warn.mockRestore();
    });

    it('reports when the filter removed every tool the choice mapped to', async () => {
      const { processor, decisions } = buildWith(
        { choice: 'email', probabilities: { github: 0.05, email: 0.9, none: 0.05 } },
        { filter: ({ toolName }: { toolName: string }) => toolName !== 'sendEmail' },
      );

      await processor.processInputStep(createArgs('email the team'));

      expect(decisions[0]).toMatchObject({ abstained: true, reason: 'tools-filtered-out', choice: 'email' });
    });

    it('fires once per user message, matching when the decision is made', async () => {
      const { processor, decisions } = buildWith({
        choice: 'github',
        probabilities: { github: 0.9, email: 0.05, none: 0.05 },
      });

      const args = createArgs('open an issue');
      await processor.processInputStep(args);
      await processor.processInputStep(args);

      expect(decisions).toHaveLength(1);
    });

    it('does not let a throwing callback fail the request', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { model } = createModel({ choice: 'github', probabilities: { github: 0.9, email: 0.05, none: 0.05 } });
      const processor = new ToolSearchProcessor({
        tools: createTools(),
        preselect: {
          classifier: new Classifier({ id: 'router', model, questions: routerQuestions }),
          question: 'domain',
          tools: preselectTools,
          onPreselect: () => {
            throw new Error('logging backend down');
          },
        },
      });

      const result = await processor.processInputStep(createArgs('open an issue'));

      // Seeding still happened; only the logging failed.
      expect(activeToolNames(result).sort()).toEqual(['createIssue', 'listIssues']);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('onPreselect callback threw'), 'logging backend down');
      warn.mockRestore();
    });
  });

  describe('registered classifiers', () => {
    it('fails with an actionable error when the id cannot be resolved', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const processor = new ToolSearchProcessor({
        tools: createTools(),
        preselect: { classifier: 'router', question: 'domain', tools: preselectTools },
      });

      // Fails open, but the warning names the cause.
      const result = await processor.processInputStep(createArgs('open an issue'));

      expect(activeToolNames(result)).toEqual([]);
      expect(warn.mock.calls[0]?.[1]).toMatchObject({
        message: expect.stringContaining("classifier 'router'"),
      });
      warn.mockRestore();
    });
  });
});
