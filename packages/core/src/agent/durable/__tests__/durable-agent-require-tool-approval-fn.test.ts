/**
 * DurableAgent function-form requireToolApproval serialization.
 *
 * A function policy cannot cross a process boundary: the closure stays on the in-process run
 * registry, and the serialized workflow input carries the safe `true` shadow. Behaviour (per-call
 * evaluation, throwing policies, resume context) is covered on every engine by the
 * `approval-policy` aimock scenario.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { globalRunRegistry } from '../run-registry';

describe('DurableAgent function-form requireToolApproval', () => {
  const pubsub = new EventEmitterPubSub();

  afterEach(async () => {
    await pubsub.close();
  });

  it('stores function policy on the registry and serializes a `true` shadow into workflow input', async () => {
    const safeTool = createTool({
      id: 'safeTool',
      description: 'safe',
      inputSchema: z.object({ x: z.number() }),
      execute: async () => 'ok',
    });
    const baseAgent = new Agent({
      id: 'fn-policy-agent',
      name: 'Fn Policy Agent',
      instructions: 'tools',
      model: new MockLanguageModelV2() as LanguageModelV2,
      tools: { safeTool },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const policy = vi.fn().mockReturnValue(false);
    const prep = await durableAgent.prepare('Run safeTool', { requireToolApproval: policy });

    // Cross-process shadow is the safe default `true`.
    expect(prep.workflowInput.options.requireToolApproval).toBe(true);
    // In-process registry preserves the closure verbatim.
    expect(globalRunRegistry.get(prep.runId)?.requireToolApproval).toBe(policy);
  });
});
