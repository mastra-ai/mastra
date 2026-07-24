import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { noopLogger } from '../../../../logger';
import { RequestContext } from '../../../../request-context';
import { createTool } from '../../../../tools';
import { CoreToolBuilder } from '../../../../tools/tool-builder/builder';
import { PUBSUB_SYMBOL } from '../../../../workflows/constants';
import { globalRunRegistry } from '../../run-registry';
import { createDurableToolCallStep } from './tool-call';

vi.mock('../../utils/resolve-runtime', () => ({
  resolveTool: vi.fn(),
  toolRequiresApproval: vi.fn().mockResolvedValue(false),
  rebuildRunToolsFromMastra: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../stream-adapter', () => ({
  emitChunkEvent: vi.fn().mockResolvedValue(undefined),
  emitSuspendedEvent: vi.fn().mockResolvedValue(undefined),
}));

const RUN_ID = 'durable-tool-actor-run';
const initialActor = { actorKind: 'system' as const, sourceWorkflow: 'initial-run' };

function mockPubsub() {
  return { publish: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn(), flush: vi.fn() };
}

async function executeToolSegment(actor?: { actorKind: 'system'; sourceWorkflow: string }) {
  const execute = vi.fn().mockResolvedValue({ result: 'ok' });
  const requestContext = new RequestContext();
  requestContext.set('organizationId', 'org-1');
  const fgaProvider = { require: vi.fn().mockResolvedValue(undefined) };
  const mastra = {
    getLogger: () => noopLogger,
    getServer: () => ({ fga: fgaProvider }),
  } as any;
  const originalTool = createTool({
    id: 'secureTool',
    description: 'A tool protected by FGA',
    inputSchema: z.object({ query: z.string() }),
    execute,
  });
  const tool = new CoreToolBuilder({
    originalTool,
    options: {
      name: 'secureTool',
      agentId: 'agent-1',
      logger: noopLogger,
      requestContext,
      mastra,
    },
  }).build();

  globalRunRegistry.set(RUN_ID, {
    tools: { secureTool: tool },
    model: {} as any,
  } as any);

  const step = createDurableToolCallStep();
  const result = await (step as any).execute({
    inputData: {
      toolCallId: 'call-1',
      toolName: 'secureTool',
      args: { query: 'mastra' },
    },
    mastra,
    suspend: vi.fn(),
    resumeData: { approved: true },
    requestContext,
    actor,
    getInitData: () => ({
      runId: RUN_ID,
      agentId: 'agent-1',
      options: { requireToolApproval: false, actor: initialActor },
      state: {},
    }),
    [PUBSUB_SYMBOL]: mockPubsub(),
  });

  return { execute, fgaProvider, result };
}

afterEach(() => {
  globalRunRegistry.delete(RUN_ID);
  vi.clearAllMocks();
});

describe('durable tool-call actor forwarding', () => {
  it('uses the actor from the resumed workflow segment at the tool and FGA boundary', async () => {
    const resumeActor = { actorKind: 'system' as const, sourceWorkflow: 'approval-resume' };

    const { execute, fgaProvider, result } = await executeToolSegment(resumeActor);

    expect(result.error).toBeUndefined();
    expect(fgaProvider.require).not.toHaveBeenCalled();
    expect(execute).toHaveBeenCalledWith({ query: 'mastra' }, expect.objectContaining({ actor: resumeActor }));
  });

  it('does not reuse the initial trusted actor when the resumed segment omits actor', async () => {
    const { execute, fgaProvider, result } = await executeToolSegment();

    expect(result.error).toEqual(
      expect.objectContaining({ message: expect.stringContaining('authenticated user is required') }),
    );
    expect(fgaProvider.require).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });
});
