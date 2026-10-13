/**
 * stream({ untilIdle }) tests for DurableAgent
 *
 * Cross-engine pins for the idle-loop entry point, modeled on
 * packages/core/src/agent/__tests__/stream-until-idle.test.ts but expressed
 * through the DurableAgentLike surface. The conformance hosts do not enable
 * background tasks, so these tests pin the no-background-manager contract
 * that every engine must share:
 *
 * - `untilIdle: true` without a background manager falls through to a plain
 *   stream (no hang, text still arrives)
 * - with memory configured but no background tasks dispatched, the loop
 *   closes after the initial turn (exactly one model call)
 * - the result still exposes the standard stream surface (fullStream,
 *   consumeStream, text)
 *
 * The background-task-driven behaviors from the source suite (lifecycle
 * event continuations, maxIdleMs re-arm, mid-flight aborts) require a live
 * BackgroundTaskManager + event engine and stay in the core unit suite.
 */

import { describe, it, expect } from 'vitest';
import { MockMemory } from '@mastra/core/memory';
import type { DurableAgentTestContext } from '../types';
import { createTextStreamModel } from '../mock-models';

async function drain(stream: ReadableStream<any> | AsyncIterable<any>): Promise<any[]> {
  const chunks: any[] = [];
  for await (const chunk of stream as AsyncIterable<any>) {
    chunks.push(chunk);
  }
  return chunks;
}

export function createStreamUntilIdleTests(context: DurableAgentTestContext) {
  const { createAgent } = context;

  describe('stream untilIdle', () => {
    it('falls through to a plain stream when no bg manager or memory is configured', async () => {
      const mockModel = createTextStreamModel('plain');

      const agent = await createAgent({
        id: 'until-idle-plain-agent',
        name: 'until-idle-plain-agent',
        instructions: 'test',
        model: mockModel,
      });

      const { output, cleanup } = await agent.stream('hi', { untilIdle: true });
      const chunks = await drain(output.fullStream);
      cleanup();

      // We got chunks from a single turn (no continuation because no memory).
      const textChunks = chunks.filter(c => c?.type?.includes('text')).length;
      expect(textChunks).toBeGreaterThan(0);
    });

    it('closes after the initial turn when no background tasks were dispatched', async () => {
      const memory = new MockMemory();
      const mockModel = createTextStreamModel('hello');

      const agent = await createAgent({
        id: 'until-idle-single-turn-agent',
        name: 'until-idle-single-turn-agent',
        instructions: 'test',
        model: mockModel,
        memory,
      });

      const { output, cleanup } = await agent.stream('hi', {
        untilIdle: true,
        memory: { thread: 'until-idle-thread-1', resource: 'until-idle-user-1' },
      });
      await drain(output.fullStream);
      cleanup();

      // Only the initial turn ran — one LLM call, no continuations.
      expect((mockModel as any).doStreamCalls).toHaveLength(1);
    });

    it('returns a MastraModelOutput-shaped result (text, consumeStream, fullStream)', async () => {
      const memory = new MockMemory();
      const mockModel = createTextStreamModel('hello world');

      const agent = await createAgent({
        id: 'until-idle-shape-agent',
        name: 'until-idle-shape-agent',
        instructions: 'test',
        model: mockModel,
        memory,
      });

      const { output, cleanup } = await agent.stream('hi', {
        untilIdle: true,
        memory: { thread: 'until-idle-thread-4', resource: 'until-idle-user-1' },
      });

      // Shape matches stream(): fullStream is a ReadableStream.
      expect(output.fullStream).toBeInstanceOf(ReadableStream);

      // consumeStream drains the outer stream to completion.
      expect(typeof output.consumeStream).toBe('function');
      await output.consumeStream();

      // Delayed promises from the initial turn resolve through the proxy.
      const text = await output.text;
      expect(text).toBe('hello world');

      cleanup();
    });
  });
}
