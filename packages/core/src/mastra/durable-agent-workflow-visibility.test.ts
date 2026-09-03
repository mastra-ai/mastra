/**
 * Durable-agent backing workflows are internal execution plumbing — they must
 * not appear in `Mastra.listWorkflows()` (which feeds Studio's workflow list)
 * but must remain resolvable by id for run inspection and recovery.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../agent';
import { createDurableAgent } from '../agent/durable/create-durable-agent';
import { MockStore } from '../storage/mock';
import { createWorkflow } from '../workflows';
import { Mastra } from './index';

function makeDurable(id: string) {
  return createDurableAgent({
    agent: new Agent({
      id,
      name: id,
      instructions: 'x',
      model: 'openai/gpt-4o',
    }),
  });
}

describe('durable-agent workflow visibility', () => {
  it('hides the backing loop workflow from listWorkflows() but keeps it resolvable by id', () => {
    const durable = makeDurable('durable-a');

    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      agents: { durable },
    });

    const loopWorkflow = durable.getWorkflow();

    expect(Object.keys(mastra.listWorkflows())).not.toContain(loopWorkflow.id);
    expect(mastra.getWorkflowById(loopWorkflow.id)).toBe(loopWorkflow);
  });

  it('keeps a user workflow visible when pre-registered under the loop workflow id', () => {
    const durable = makeDurable('durable-b');
    const loopWorkflowId = durable.getWorkflow().id;

    const userWorkflow = createWorkflow({
      id: loopWorkflowId,
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    }).commit();

    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      workflows: { [loopWorkflowId]: userWorkflow },
      agents: { durable },
    });

    // addWorkflow() no-ops on key collision, so the user's workflow keeps the
    // slot and must not be hidden by the durable-agent registration.
    expect(mastra.listWorkflows()[loopWorkflowId]).toBe(userWorkflow);
  });
});
