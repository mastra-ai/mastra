import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Classifier } from '@mastra/core/classifier';
import { Mastra } from '@mastra/core/mastra';
import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import { LibSQLStore } from '@mastra/libsql';
import { expect, it } from 'vitest';

import { loadConfig } from '../src/mastra/config';
import { CLASSIFIER_ID, COMPETITOR_CHANGE_QUESTIONS } from '../src/mastra/lib/classification';
import { MonitorStore } from '../src/mastra/lib/store';
import { createCompetitorMonitorAgent } from '../src/mastra/monitor-agent';
import { createCompetitorMonitorWorkflow } from '../src/mastra/workflows/competitor-monitor-workflow';
import { EVALUATION_FIXTURES } from './fixtures/evaluation-dataset';

it.each(
  (['generate', 'stream'] as const).flatMap(method =>
    (['supplied', 'thread', 'resource'] as const).map(history => ({ method, history })),
  ),
)('chat_follow_up_recovers_monitor_context ($method, $history)', async ({ method, history }) => {
  const directory = await mkdtemp(join(tmpdir(), 'competitor-monitor-chat-'));
  const config = loadConfig({
    MONITOR_DATABASE_URL: `file:${join(directory, 'monitor.db')}`,
    MASTRA_DATABASE_URL: `file:${join(directory, 'mastra.db')}`,
    TYPESAFE_AI_API_KEY: 'synthetic',
  });
  const store = MonitorStore.open(config.storage.monitorUrl);
  let framework = new LibSQLStore({ id: 'chat-test', url: config.storage.mastraUrl });
  let price = '$19';
  let classifications = 0;
  const fixture = EVALUATION_FIXTURES.find(item => item.family === 'pricing')!;
  const workflow = createCompetitorMonitorWorkflow({
    store,
    config,
    resolver: async () => [{ address: '93.184.216.34', family: 4 }],
    transport: async ({ url }) => ({
      status: 200,
      headers: { 'content-type': url.pathname === '/robots.txt' ? 'text/plain' : 'text/html' },
      body: new TextEncoder().encode(
        url.pathname === '/robots.txt'
          ? 'User-agent: *\nAllow: /'
          : `<main><h1>Pricing</h1><p>Starter costs ${price}.</p><p>${'Public product pricing and documentation details for customers. '.repeat(15)}</p></main>`,
      ),
    }),
  });
  const inputData = {
    monitorId: 'example-product',
    runMode: 'manual',
    profile: { name: 'Example product', interests: ['pricing'] },
    sources: [{ id: 'pricing', label: 'Pricing', url: 'https://public.example/pricing', kind: 'pricing' }],
    options: { generateSummary: false, includeUnchangedSources: true },
  };
  let modelCalls = 0;
  let conversation: any[] = [];
  let nextInput = inputData;
  const followUpPrompts: string[] = [];
  const firstMessage = 'Check Example product pricing at https://public.example/pricing.';
  const workingMemory = `# Competitor Monitoring Context
- Last User Message: ${firstMessage}
- Active Company: Other product
## Example product
Saved Config: ${JSON.stringify(inputData)}
## Other product
Saved Config: ${JSON.stringify({ ...inputData, monitorId: 'other-product', profile: { name: 'Other product', interests: ['features'] }, sources: [{ id: 'docs', url: 'https://other.example/docs', kind: 'documentation' }] })}`;
  function memoryCall() {
    return {
      type: 'tool-call' as const,
      toolCallId: 'save-context',
      toolName: 'updateWorkingMemory',
      input: JSON.stringify({ memory: workingMemory }),
    };
  }
  function inputFromHistory(options: { prompt: unknown }) {
    const prompt = JSON.stringify(options.prompt);
    const genericFollowUp = conversation.length > 0;
    if (genericFollowUp && modelCalls % 2 === 0) {
      expect(prompt).toContain(history === 'resource' ? 'Check Example product again.' : 'Check the same pages again.');
      expect(prompt).toContain('example-product');
      expect(prompt).toContain('https://public.example/pricing');
      // Infer the next call from native working memory or actual tool-call history, never the fixture out of band.
      const previousCall = (options.prompt as any[])
        .flatMap(message => (Array.isArray(message.content) ? message.content : []))
        .filter(part => part.type === 'tool-call' && part.toolName === 'workflow-competitorMonitor')
        .at(-1);
      if (history === 'resource') {
        expect(previousCall).toBeUndefined();
        expect(prompt).toContain(firstMessage);
        const systemText = (options.prompt as any[])
          .filter(message => message.role === 'system')
          .map(message => message.content)
          .join('\n');
        const saved = systemText.match(/## Example product\nSaved Config: (\{[^\n]+\})/);
        expect(saved).not.toBeNull();
        nextInput = JSON.parse(saved![1]!);
      } else {
        expect(previousCall).toBeDefined();
        const previous = typeof previousCall.input === 'string' ? JSON.parse(previousCall.input) : previousCall.input;
        nextInput = previous.inputData;
      }
      expect(nextInput).toMatchObject({
        monitorId: 'example-product',
        sources: [{ id: 'pricing', url: 'https://public.example/pricing' }],
      });
      followUpPrompts.push(prompt);
    }
  }
  const model = new MastraLanguageModelV2Mock({
    doGenerate: async options => {
      inputFromHistory(options);
      const call = modelCalls++;
      return {
        content:
          call % 2 === 0
            ? [
                {
                  type: 'tool-call' as const,
                  toolCallId: `monitor-${call}`,
                  toolName: 'workflow-competitorMonitor',
                  input: JSON.stringify({ inputData: nextInput }),
                },
                ...(history === 'resource' && call === 0 ? [memoryCall()] : []),
              ]
            : [{ type: 'text' as const, text: 'Monitor result received.' }],
        finishReason: call % 2 === 0 ? 'tool-calls' : 'stop',
        usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
        warnings: [],
      };
    },
    doStream: async options => {
      inputFromHistory(options);
      const call = modelCalls++;
      const chunks =
        call % 2 === 0
          ? [
              {
                type: 'tool-call' as const,
                toolCallId: `monitor-${call}`,
                toolName: 'workflow-competitorMonitor',
                input: JSON.stringify({ inputData: nextInput }),
              },
              ...(history === 'resource' && call === 0 ? [memoryCall()] : []),
            ]
          : [
              { type: 'text-start' as const, id: 'reply' },
              { type: 'text-delta' as const, id: 'reply', delta: 'Monitor result received.' },
              { type: 'text-end' as const, id: 'reply' },
            ];
      return {
        stream: new ReadableStream({
          start(controller) {
            for (const chunk of chunks) controller.enqueue(chunk);
            controller.enqueue({
              type: 'finish',
              finishReason: call % 2 === 0 ? 'tool-calls' : 'stop',
              usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
            });
            controller.close();
          },
        }),
      };
    },
  });
  const agent = createCompetitorMonitorAgent(workflow, model);
  const classifier = new Classifier({
    id: CLASSIFIER_ID,
    questions: COMPETITOR_CHANGE_QUESTIONS,
    model: {
      specificationVersion: 'v4',
      provider: 'fixture',
      modelId: 'fixture',
      supportedQuestionTypes: ['choice', 'score', 'boolean'],
      doEvaluate: async () => {
        classifications++;
        return {
          answers: {
            ...fixture.answers!,
            change_type: {
              ...fixture.answers!.change_type,
              probabilities: Object.fromEntries(
                Object.keys(COMPETITOR_CHANGE_QUESTIONS.change_type.criteria).map(choice => [
                  choice,
                  choice === 'pricing' ? 1 : 0,
                ]),
              ),
            },
          },
          usage: {},
          warnings: [],
          rounding: {},
          providerMetadata: fixture.providerMetadata,
          response: { modelId: 'fixture', timestamp: new Date() },
        };
      },
    } as any,
  });
  let mastra = new Mastra({
    agents: { competitorMonitor: agent },
    workflows: { competitorMonitor: workflow },
    classifiers: { competitorChange: classifier },
    storage: framework,
  });
  async function check() {
    const activeAgent = mastra.getAgent('competitorMonitor');
    const userMessage = {
      role: 'user' as const,
      content: conversation.length
        ? history === 'resource'
          ? 'Check Example product again.'
          : 'Check the same pages again.'
        : firstMessage,
    };
    const supplied = history === 'supplied' ? [...conversation, userMessage] : [userMessage];
    const options =
      history === 'supplied'
        ? {}
        : {
            memory: { resource: 'test-operator', thread: history === 'thread' ? 'pricing-chat' : `chat-${modelCalls}` },
          };
    const result =
      method === 'generate'
        ? await activeAgent.generate(supplied, options)
        : await activeAgent.stream(supplied, options);
    if (method === 'stream') await (result as Awaited<ReturnType<typeof activeAgent.stream>>).consumeStream();
    expect(await result.text).toBe('Monitor result received.');
    const response = await result.response;
    conversation = [...supplied, ...(response.messages ?? [])];
    const steps = await result.steps;
    const toolResult = steps
      .flatMap(step => step.toolResults)
      .find(item => item.payload.toolName === 'workflow-competitorMonitor');
    expect(toolResult).toBeDefined();
    return (
      toolResult!.payload.result as {
        result: {
          status: string;
          counts: { candidatesClassified: number };
          changes: Array<{ evidence?: { beforeExcerpt: string; afterExcerpt: string } }>;
        };
      }
    ).result;
  }
  try {
    const baseline = await check();
    expect(baseline.status).toBe('success');
    expect(classifications).toBe(0);
    if (history !== 'supplied') {
      // Rebuild the agent and storage connection to prove disk persistence, not process-local history.
      await framework.close();
      framework = new LibSQLStore({ id: 'chat-restarted', url: config.storage.mastraUrl });
      mastra = new Mastra({
        agents: { competitorMonitor: createCompetitorMonitorAgent(workflow, model) },
        workflows: { competitorMonitor: workflow },
        classifiers: { competitorChange: classifier },
        storage: framework,
      });
      const memory = (await mastra.getAgent('competitorMonitor').getMemory())!;
      expect(await memory.getWorkingMemory({ threadId: 'unrelated-chat', resourceId: 'other-operator' })).toBeNull();
      if (history === 'resource') {
        expect(await memory.getWorkingMemory({ threadId: 'new-chat', resourceId: 'test-operator' })).toBe(
          workingMemory,
        );
      }
    }
    price = '$29';
    const changed = await check();
    expect(changed.counts.candidatesClassified).toBe(1);
    expect(changed.changes[0]?.evidence).toMatchObject({
      beforeExcerpt: 'Starter costs $19.',
      afterExcerpt: 'Starter costs $29.',
    });
    expect(classifications).toBe(1);
    const unchanged = await check();
    expect(unchanged.status).toBe('no_change');
    expect(classifications).toBe(1);
    expect(followUpPrompts).toHaveLength(2);
    if (history !== 'resource') {
      expect(followUpPrompts[1]).toContain('Starter costs $19.');
      expect(followUpPrompts[1]).toContain('Starter costs $29.');
    }
    expect((await store.client.execute('SELECT * FROM classification_decisions')).rows).toHaveLength(1);
  } finally {
    await store.close();
    await framework.close();
  }
});
