/**
 * FGA / actor-identity tests for DurableAgent
 *
 * Cross-engine pins for fine-grained authorization and actor threading,
 * modeled on packages/core/src/agent/__tests__/agent-fga.test.ts but
 * expressed through the DurableAgentLike surface so every leg (DurableAgent,
 * EventedAgent, plain Agent, Inngest) exercises the same contract:
 *
 * - the actor passed to stream() reaches the tool execution context
 * - no actor → tools see undefined (no leaked/stale identity)
 * - a resumed segment authorizes and executes with the *resume-call* actor,
 *   never the actor persisted at prepare time
 * - with an FGA provider configured, agents:execute is enforced *before*
 *   the model runs (the durable-bypass regression class)
 * - fail closed when FGA is configured and no identity is available
 * - a trusted system actor bypasses user-membership resolution
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { RequestContext } from '@mastra/core/request-context';
import { FGADeniedError } from '@mastra/core/auth/ee';
import type { IFGAProvider } from '@mastra/core/auth/ee';
import type { DurableAgentTestContext } from '../types';
import { createTextStreamModel, createToolCallThenTextModel } from '../mock-models';

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createFGAProvider(authorized = true): IFGAProvider {
  return {
    check: vi.fn().mockResolvedValue(authorized),
    require: authorized
      ? vi.fn().mockResolvedValue(undefined)
      : vi
          .fn()
          .mockRejectedValue(
            new FGADeniedError({ id: 'user-1' }, { type: 'agent', id: 'fga-agent' }, 'agents:execute'),
          ),
    filterAccessible: vi.fn(),
  } as unknown as IFGAProvider;
}

/** Read the actor off a tool execution context regardless of engine shape. */
function actorOf(context: unknown): unknown {
  return (context as { actor?: unknown } | undefined)?.actor;
}

export function createFGATests(context: DurableAgentTestContext) {
  const { createAgent, eventPropagationDelay } = context;
  const executionDelay = Math.max(eventPropagationDelay * 2, 500);

  describe('FGA / actor identity', () => {
    describe('actor passthrough', () => {
      it('forwards the stream() actor into the tool execution context', async () => {
        let capturedActor: unknown = 'unset';

        const captureActorTool = createTool({
          id: 'captureActorTool',
          description: 'Captures the actor from the execution context',
          inputSchema: z.object({ probe: z.string() }),
          execute: async (_input, toolContext) => {
            capturedActor = actorOf(toolContext);
            return { ok: true };
          },
        });

        const mockModel = createToolCallThenTextModel('captureActorTool', { probe: 'x' }, 'Done');

        const agent = await createAgent({
          id: 'fga-actor-stream-agent',
          instructions: 'Use the capture tool',
          model: mockModel,
          tools: { captureActorTool },
        });

        const actor = { actorKind: 'system' as const, agentId: 'ops-agent', sourceWorkflow: 'nightly-job' };
        const { output, cleanup } = await agent.stream('Capture the actor', { actor });

        // Drain to completion so the tool has definitely executed.
        for await (const _chunk of output.textStream) {
          void _chunk;
        }
        cleanup();

        expect(capturedActor).toMatchObject(actor);
      });

      it('tools see no actor when stream() is called without one', async () => {
        let capturedActor: unknown = 'unset';

        const captureActorTool = createTool({
          id: 'captureActorTool',
          description: 'Captures the actor from the execution context',
          inputSchema: z.object({ probe: z.string() }),
          execute: async (_input, toolContext) => {
            capturedActor = actorOf(toolContext);
            return { ok: true };
          },
        });

        const mockModel = createToolCallThenTextModel('captureActorTool', { probe: 'x' }, 'Done');

        const agent = await createAgent({
          id: 'fga-no-actor-agent',
          instructions: 'Use the capture tool',
          model: mockModel,
          tools: { captureActorTool },
        });

        const { output, cleanup } = await agent.stream('Capture the actor');

        for await (const _chunk of output.textStream) {
          void _chunk;
        }
        cleanup();

        // The tool ran (capturedActor moved off the sentinel) and saw no actor.
        expect(capturedActor).toBeUndefined();
      });

      it('a resumed segment executes with the resume-call actor, not the initial one', async () => {
        const capturedActors: unknown[] = [];

        const gatedTool = createTool({
          id: 'gatedTool',
          description: 'Suspends on first call, completes on resume',
          inputSchema: z.object({ probe: z.string() }),
          execute: async (_input, toolContext: any) => {
            capturedActors.push(actorOf(toolContext));
            const suspend = toolContext?.agent?.suspend || toolContext?.suspend;
            const resumeData = toolContext?.agent?.resumeData || toolContext?.resumeData;
            if (suspend && !resumeData) {
              await suspend({ reason: 'Need approval' });
            }
            return { done: true };
          },
        });

        const mockModel = createToolCallThenTextModel('gatedTool', { probe: 'x' }, 'Resumed!');

        const agent = await createAgent({
          id: 'fga-resume-actor-agent',
          instructions: 'Use the gated tool',
          model: mockModel,
          tools: { gatedTool },
          needsStorage: true,
        });

        const initialActor = { actorKind: 'system' as const, agentId: 'initial-agent' };
        let suspendedData: any = null;
        const { runId, cleanup } = await agent.stream('Use the gated tool', {
          actor: initialActor,
          onSuspended: (data: any) => {
            suspendedData = data;
          },
        });

        await delay(executionDelay);
        expect(suspendedData).not.toBeNull();
        expect(capturedActors[0]).toMatchObject(initialActor);

        const resumeActor = { actorKind: 'system' as const, agentId: 'resume-agent' };
        let finishData: any = null;
        const resumeResult = await agent.resume!(
          runId,
          { confirmed: true },
          {
            actor: resumeActor,
            onFinish: (data: any) => {
              finishData = data;
            },
          },
        );

        await delay(executionDelay * 2);
        expect(finishData).not.toBeNull();

        // The resumed tool execution must see the actor supplied to resume():
        // a resumed segment never recovers the initial actor from serialized
        // agent options (that would let a stale identity authorize new work).
        expect(capturedActors.length).toBeGreaterThanOrEqual(2);
        expect(capturedActors[capturedActors.length - 1]).toMatchObject(resumeActor);

        resumeResult.cleanup();
        cleanup();
      });
    });

    describe('agents:execute enforcement', () => {
      it('stream() rejects before the model runs when agents:execute is denied', async () => {
        const fgaProvider = createFGAProvider(false);
        const mockModel = createTextStreamModel('should never stream');

        const agent = await createAgent({
          id: 'fga-denied-agent',
          instructions: 'Test denial',
          model: mockModel,
          fga: fgaProvider,
        });

        const requestContext = new RequestContext();
        requestContext.set('user', { id: 'user-1', organizationMembershipId: 'om-1' });

        await expect(agent.stream('hello', { requestContext })).rejects.toThrow(FGADeniedError);
        expect(fgaProvider.require).toHaveBeenCalled();
        // Denial happens before execution: the model must never be invoked.
        expect((mockModel as any).doStreamCalls).toHaveLength(0);
      });

      it('fails closed when FGA is configured and no identity is available', async () => {
        const fgaProvider = createFGAProvider(true);
        const mockModel = createTextStreamModel('should never stream');

        const agent = await createAgent({
          id: 'fga-fail-closed-agent',
          instructions: 'Test fail-closed',
          model: mockModel,
          fga: fgaProvider,
        });

        // No user in the request context and no actor on the call.
        await expect(agent.stream('hello', { requestContext: new RequestContext() })).rejects.toThrow(FGADeniedError);
        expect(fgaProvider.require).not.toHaveBeenCalled();
        expect((mockModel as any).doStreamCalls).toHaveLength(0);
      });

      it('a trusted system actor bypasses user-membership resolution', async () => {
        const fgaProvider = {
          ...createFGAProvider(true),
          requireActor: vi.fn().mockResolvedValue(undefined),
        } as unknown as IFGAProvider;
        const mockModel = createTextStreamModel('actor run ok');

        const agent = await createAgent({
          id: 'fga-trusted-actor-agent',
          instructions: 'Test trusted actor',
          model: mockModel,
          fga: fgaProvider,
        });

        const requestContext = new RequestContext();
        requestContext.set('organizationId', 'org-1');

        const { output, cleanup } = await agent.stream('hello', {
          requestContext,
          actor: { actorKind: 'system' as const, sourceWorkflow: 'nightly-workflow' },
        });

        let text = '';
        for await (const chunk of output.textStream) {
          text += chunk;
        }
        cleanup();

        expect(text).toContain('actor run ok');
        // The user-membership path must not run for a trusted system actor.
        expect(fgaProvider.require).not.toHaveBeenCalled();
        expect((mockModel as any).doStreamCalls).toHaveLength(1);
      });
    });
  });
}
