/**
 * PubSub tests for DurableAgent
 */

import { describe, it, expect } from 'vitest';
import { DurableAgent, AGENT_STREAM_TOPIC, AgentStreamEventTypes } from '@mastra/core/agent/durable';
import type { AgentStreamEvent } from '@mastra/core/agent/durable';
import type { DurableAgentTestContext } from '../types';
import { createTextStreamModel } from '../mock-models';

export function createPubSubTests({ getPubSub, eventPropagationDelay }: DurableAgentTestContext) {
  describe('pubsub integration', () => {
    it('should emit events to the correct topic', async () => {
      const pubsub = getPubSub();
      const receivedEvents: AgentStreamEvent[] = [];
      const runId = 'test-run-123';

      // Subscribe to events
      await pubsub.subscribe(AGENT_STREAM_TOPIC(runId), event => {
        receivedEvents.push(event as unknown as AgentStreamEvent);
      });

      // Publish a test event
      await pubsub.publish(AGENT_STREAM_TOPIC(runId), {
        type: AgentStreamEventTypes.CHUNK,
        runId,
        data: { type: 'text-delta', payload: { text: 'Hello' } },
      });

      // Wait a tick for event to be processed
      await new Promise(resolve => setTimeout(resolve, eventPropagationDelay / 10));

      expect(receivedEvents.length).toBe(1);
      expect(receivedEvents[0].type).toBe(AgentStreamEventTypes.CHUNK);
    });

    it('should handle multiple event types', async () => {
      const pubsub = getPubSub();
      const receivedEvents: AgentStreamEvent[] = [];
      const runId = 'test-run-multi-events';

      await pubsub.subscribe(AGENT_STREAM_TOPIC(runId), event => {
        receivedEvents.push(event as unknown as AgentStreamEvent);
      });

      // Publish different event types
      await pubsub.publish(AGENT_STREAM_TOPIC(runId), {
        type: AgentStreamEventTypes.STEP_START,
        runId,
        data: { stepId: 'step-1' },
      });

      await pubsub.publish(AGENT_STREAM_TOPIC(runId), {
        type: AgentStreamEventTypes.CHUNK,
        runId,
        data: { type: 'text-delta', payload: { text: 'Hello' } },
      });

      await pubsub.publish(AGENT_STREAM_TOPIC(runId), {
        type: AgentStreamEventTypes.STEP_FINISH,
        runId,
        data: { stepResult: { reason: 'stop' } },
      });

      await new Promise(resolve => setTimeout(resolve, eventPropagationDelay / 10));

      expect(receivedEvents.length).toBe(3);
      expect(receivedEvents.map(e => e.type)).toEqual([
        AgentStreamEventTypes.STEP_START,
        AgentStreamEventTypes.CHUNK,
        AgentStreamEventTypes.STEP_FINISH,
      ]);
    });

    it('should emit events to the correct topic based on runId', async () => {
      const mockModel = createTextStreamModel('Pubsub test');
      const receivedEvents: AgentStreamEvent[] = [];
      const pubsub = getPubSub();

      const agent = new DurableAgent({
        id: 'pubsub-test-agent',
        name: 'Pubsub Test Agent',
        instructions: 'Test',
        model: mockModel,
        pubsub,
      });

      // Prepare to get the runId first
      const preparation = await agent.prepare('Test message');

      // Subscribe to events for this run
      await pubsub.subscribe(AGENT_STREAM_TOPIC(preparation.runId), event => {
        receivedEvents.push(event as unknown as AgentStreamEvent);
      });

      // Now we need to manually emit events since the workflow isn't actually running
      // In a real integration test, the workflow would emit these
      await pubsub.publish(AGENT_STREAM_TOPIC(preparation.runId), {
        type: AgentStreamEventTypes.CHUNK,
        runId: preparation.runId,
        data: { type: 'text-delta', payload: { text: 'test' } },
      });

      await new Promise(resolve => setTimeout(resolve, eventPropagationDelay / 2));

      expect(receivedEvents.length).toBe(1);
      expect(receivedEvents[0].type).toBe(AgentStreamEventTypes.CHUNK);
    });

    it('should isolate events between different runs', async () => {
      const mockModel = createTextStreamModel('Test');
      const eventsRun1: AgentStreamEvent[] = [];
      const eventsRun2: AgentStreamEvent[] = [];
      const pubsub = getPubSub();

      const agent = new DurableAgent({
        id: 'isolation-test-agent',
        name: 'Isolation Test Agent',
        instructions: 'Test',
        model: mockModel,
        pubsub,
      });

      const prep1 = await agent.prepare('Message 1');
      const prep2 = await agent.prepare('Message 2');

      await pubsub.subscribe(AGENT_STREAM_TOPIC(prep1.runId), event => {
        eventsRun1.push(event as unknown as AgentStreamEvent);
      });

      await pubsub.subscribe(AGENT_STREAM_TOPIC(prep2.runId), event => {
        eventsRun2.push(event as unknown as AgentStreamEvent);
      });

      // Emit event to run1 only
      await pubsub.publish(AGENT_STREAM_TOPIC(prep1.runId), {
        type: AgentStreamEventTypes.CHUNK,
        runId: prep1.runId,
        data: { type: 'text-delta', payload: { text: 'for run 1' } },
      });

      await new Promise(resolve => setTimeout(resolve, eventPropagationDelay / 2));

      expect(eventsRun1.length).toBe(1);
      expect(eventsRun2.length).toBe(0);
    });
  });

  describe('emit helper functions', () => {
    it('emitChunkEvent should publish chunk events', async () => {
      const { emitChunkEvent } = await import('@mastra/core/agent/durable');
      const pubsub = getPubSub();
      const runId = 'test-emit-chunk';
      const received: any[] = [];

      await pubsub.subscribe(AGENT_STREAM_TOPIC(runId), event => {
        received.push(event);
      });

      await emitChunkEvent(pubsub, runId, { type: 'text-delta', payload: { text: 'test' } } as any);
      await new Promise(resolve => setTimeout(resolve, eventPropagationDelay / 10));

      expect(received.length).toBe(1);
      expect(received[0].type).toBe(AgentStreamEventTypes.CHUNK);
    });

    it('emitErrorEvent should publish error events', async () => {
      const { emitErrorEvent } = await import('@mastra/core/agent/durable');
      const pubsub = getPubSub();
      const runId = 'test-emit-error';
      const received: any[] = [];

      await pubsub.subscribe(AGENT_STREAM_TOPIC(runId), event => {
        received.push(event);
      });

      const error = new Error('Test error');
      error.stack = 'test stack';
      await emitErrorEvent(pubsub, runId, error);
      await new Promise(resolve => setTimeout(resolve, eventPropagationDelay / 10));

      expect(received.length).toBe(1);
      expect(received[0].type).toBe(AgentStreamEventTypes.ERROR);
      expect(received[0].data.error.message).toBe('Test error');
      expect(received[0].data.error.stack).toBe('test stack');
    });

    it('emitSuspendedEvent should publish suspended events', async () => {
      const { emitSuspendedEvent } = await import('@mastra/core/agent/durable');
      const pubsub = getPubSub();
      const runId = 'test-emit-suspended';
      const received: any[] = [];

      await pubsub.subscribe(AGENT_STREAM_TOPIC(runId), event => {
        received.push(event);
      });

      await emitSuspendedEvent(pubsub, runId, {
        type: 'approval',
        toolCallId: 'tc-1',
        toolName: 'myTool',
        args: { foo: 'bar' },
      });
      await new Promise(resolve => setTimeout(resolve, eventPropagationDelay / 10));

      expect(received.length).toBe(1);
      expect(received[0].type).toBe(AgentStreamEventTypes.SUSPENDED);
      expect(received[0].data.toolName).toBe('myTool');
      expect(received[0].data.type).toBe('approval');
    });
  });
}
