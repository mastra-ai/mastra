/**
 * Durable tool-call: request context supplied to the approval check (issue #22491).
 *
 * The approval context handed to `toolRequiresApproval` (and from there to a
 * per-tool `needsApprovalFn`) used to be built only from the in-process run
 * registry. On a cross-process worker, or on a resume after a restart, that
 * registry is empty, so context-aware approval predicates saw no request
 * context at all. The step now falls back to the persisted
 * `requestContextEntries` snapshot — the same source the tool rebuild uses.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequestContext } from '../../../../request-context';
import { globalRunRegistry } from '../../run-registry';
import * as resolveRuntime from '../../utils/resolve-runtime';
import { createDurableToolCallStep } from './tool-call';

vi.mock('../../utils/resolve-runtime', async () => ({
  restoreRequestContext: (
    await vi.importActual<typeof import('../../utils/resolve-runtime')>('../../utils/resolve-runtime')
  ).restoreRequestContext,
  resolveTool: vi.fn(),
  toolRequiresApproval: vi.fn().mockResolvedValue(false),
  rebuildRunToolsFromMastra: vi.fn().mockResolvedValue(undefined),
}));

const toolRequiresApproval = vi.mocked(resolveRuntime.toolRequiresApproval);
const resolveTool = vi.mocked(resolveRuntime.resolveTool);

function makeParams(runId: string, overrides: Record<string, any> = {}) {
  return {
    inputData: { toolCallId: 'call-1', toolName: 'gatedTool', args: { q: 1 } },
    mastra: { getLogger: () => undefined },
    suspend: vi.fn(),
    getInitData: () => ({ runId, agentId: 'agent-1', options: {}, state: {} }),
    ...overrides,
  };
}

function approvalContextArg() {
  expect(toolRequiresApproval).toHaveBeenCalledTimes(1);
  return toolRequiresApproval.mock.calls[0]![3] as { requestContext?: Record<string, unknown> };
}

describe('durable tool-call approval request context', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('restores the request context from the persisted snapshot when no registry entry exists (cross-process)', async () => {
    const runId = 'approval-ctx-xproc';
    resolveTool.mockReturnValue({ execute: vi.fn().mockResolvedValue('ok') } as any);

    await (createDurableToolCallStep() as any).execute(
      makeParams(runId, {
        getInitData: () => ({
          runId,
          agentId: 'agent-1',
          options: {},
          state: {},
          requestContextEntries: {
            channel: { platform: 'imessage' },
            __mastra_requireToolApproval: true,
          },
        }),
      }),
    );

    expect(approvalContextArg().requestContext).toEqual({ channel: { platform: 'imessage' } });
  });

  it('prefers the live registry request context over the snapshot when present', async () => {
    const runId = 'approval-ctx-live';
    globalRunRegistry.set(runId, {
      tools: { gatedTool: { execute: vi.fn().mockResolvedValue('ok') } },
      requestContext: new RequestContext<unknown>([
        ['channel', { platform: 'web' }],
        ['__mastra_requireToolApproval', true],
      ]),
    } as any);

    try {
      await (createDurableToolCallStep() as any).execute(
        makeParams(runId, {
          getInitData: () => ({
            runId,
            agentId: 'agent-1',
            options: {},
            state: {},
            requestContextEntries: { channel: { platform: 'imessage' } },
          }),
        }),
      );
    } finally {
      globalRunRegistry.delete(runId);
    }

    expect(approvalContextArg().requestContext).toEqual({ channel: { platform: 'web' } });
  });

  it('falls back to the step run-level request context when there is no snapshot', async () => {
    const runId = 'approval-ctx-runlevel';
    resolveTool.mockReturnValue({ execute: vi.fn().mockResolvedValue('ok') } as any);

    await (createDurableToolCallStep() as any).execute(
      makeParams(runId, { requestContext: new RequestContext<unknown>([['tenant', 'acme']]) }),
    );

    expect(approvalContextArg().requestContext).toEqual({ tenant: 'acme' });
  });
});
