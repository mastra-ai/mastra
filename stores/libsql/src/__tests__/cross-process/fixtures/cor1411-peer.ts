import { createDurableAgent, createEventedAgent, DurableStepIds } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';

import { LibSQLStore } from '../../../storage';
import { runPeer } from '../peer-runtime';
import { createStepAgent } from '../step-agent';

export interface Cor1411PeerArgs {
  engine: 'durable' | 'evented';
  agentId: string;
  runId: string;
  finalText: string;
  prompt: string;
  blockRefresh?: boolean;
}

export interface Cor1411PeerResult {
  text: string;
  finishReason?: string;
  processorResolutions: number;
  processorCalls: number;
  resolvedTenantId?: string;
  scoringDataDefined: boolean;
  scoringInputIncludesPrompt: boolean;
  scoringOutputIncludesAnswer: boolean;
  messagesIncludeAnswer: boolean;
  onFinishMessagesIncludeAnswer: boolean;
}

const uppercaser = (onCall: () => void) => ({
  id: 'uppercaser',
  name: 'Uppercaser',
  processOutputStream: async ({ part }: { part: any }) => {
    if (part.type === 'text-delta' && typeof part.payload?.text === 'string') {
      onCall();
      return { ...part, payload: { ...part.payload, text: part.payload.text.toUpperCase() } };
    }
    return part;
  },
});

runPeer<Cor1411PeerArgs>(async (peer): Promise<Cor1411PeerResult> => {
  const { agentId, engine, finalText, prompt, runId } = peer.args;
  let processorResolutions = 0;
  let processorCalls = 0;
  let resolvedTenantId: string | undefined;
  const { agent } = createStepAgent({
    id: agentId,
    steps: 2,
    finalText,
    outputProcessors: ({ requestContext }: { requestContext: { get(key: string): unknown } }) => {
      processorResolutions += 1;
      resolvedTenantId = requestContext.get('tenantId') as string | undefined;
      return [uppercaser(() => (processorCalls += 1))];
    },
  });
  const runner = engine === 'durable' ? createDurableAgent({ agent }) : createEventedAgent({ agent });
  const storage = new LibSQLStore({ id: `cor1411-peer-${process.pid}`, url: peer.dbUrl });
  const mastra = new Mastra({
    agents: { observer: runner },
    storage,
    pubsub: peer.pubsub(),
    logger: false,
    workers: false,
  });
  if ((mastra.getAgent('observer') as unknown) !== runner) throw new Error('Mastra replaced the observer agent');
  processorResolutions = 0;

  try {
    await peer.waitFor('run-live', { timeoutMs: 60_000 });
    const workflowsStore = await storage.getStore('workflows');
    const getWorkflowRunById = workflowsStore?.getWorkflowRunById.bind(workflowsStore);
    let blockRefresh = false;
    let refreshBlocked = false;
    let observedFinalText = false;
    if (workflowsStore && getWorkflowRunById) {
      workflowsStore.getWorkflowRunById = async args => {
        if (
          blockRefresh &&
          observedFinalText &&
          !refreshBlocked &&
          args.workflowName === DurableStepIds.AGENTIC_EXECUTION
        ) {
          refreshBlocked = true;
          await peer.signal('refresh-started', { runId });
          await peer.waitFor('release-refresh', { timeoutMs: 60_000 });
        }
        return getWorkflowRunById(args);
      };
    }

    let onFinishMessagesIncludeAnswer = false;
    const observed = await runner.observe(runId, {
      onChunk: chunk => {
        if (chunk.type === 'text-delta' && chunk.payload.text.includes(finalText.toUpperCase())) {
          observedFinalText = true;
        }
      },
      onFinish: data => {
        onFinishMessagesIncludeAnswer = JSON.stringify(data.messages).includes(finalText.toUpperCase());
      },
    });
    blockRefresh = peer.args.blockRefresh === true;
    const outputPromise = observed.output.getFullOutput();
    await peer.signal('observer-attached', { runId });
    for await (const _chunk of observed.fullStream) {
      // Drain the observed stream.
    }
    const output = await outputPromise;
    const scoringData = output.scoringData;
    return {
      text: output.text,
      finishReason: output.finishReason,
      processorResolutions,
      processorCalls,
      resolvedTenantId,
      scoringDataDefined: scoringData !== undefined,
      scoringInputIncludesPrompt: JSON.stringify(scoringData?.input)?.includes(prompt) ?? false,
      scoringOutputIncludesAnswer: JSON.stringify(scoringData?.output)?.includes(finalText.toUpperCase()) ?? false,
      messagesIncludeAnswer: JSON.stringify(output.messages).includes(finalText.toUpperCase()),
      onFinishMessagesIncludeAnswer,
    };
  } finally {
    await mastra.shutdown();
    await storage.close();
  }
});
