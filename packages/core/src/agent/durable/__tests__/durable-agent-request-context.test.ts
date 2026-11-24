/**
 * DurableAgent RequestContext Tests
 *
 * Tests for RequestContext reserved keys and security features.
 * Validates that middleware can securely set resourceId and threadId
 * via reserved keys that take precedence over client-provided values.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { MockMemory } from '../../../memory/mock';
import { RequestContext, MASTRA_AUTH_TOKEN_KEY, MASTRA_INHERITED_MEMORY_KEY } from '../../../request-context';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a simple text model
 */
function createTextModel(text: string) {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      content: [{ type: 'text', text }],
      warnings: [],
    }),
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

// ============================================================================
// DurableAgent RequestContext Tests
// ============================================================================

describe('DurableAgent RequestContext reserved keys', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  describe('RequestContext serialization', () => {
    it('snapshots JSON-safe requestContext entries for parity with the non-durable agent', async () => {
      const mockModel = createTextModel('Hello!');

      const baseAgent = new Agent({
        id: 'serialize-context-agent',
        name: 'Serialize Context Agent',
        instructions: 'Test serialization',
        model: mockModel as LanguageModelV2,
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const requestContext = new RequestContext();
      requestContext.set('userId', 'user-123');
      // A delegated/caller context can still carry the parent's framework-managed
      // memory entry before preparation installs or clears this run's own value.
      requestContext.set('MastraMemory', { thread: { id: 'parent-thread' }, resourceId: 'parent-resource' });
      // Non-JSON values are dropped from the snapshot.
      requestContext.set('liveHandle', () => 'not-serializable');

      const result = await durableAgent.prepare('Hello', {
        requestContext,
      });

      // The serializable subset of requestContext is snapshotted on workflow
      // input so durable scorers can see customContext, mirroring the
      // non-durable agent which forwards Object.fromEntries(requestContext.entries())
      // to scorers. The full RequestContext (which can hold live handles) is
      // not serialized — it stays on the run registry.
      //
      // The snapshot is taken *after* input processors run (so their writes
      // reach the durable run, #23904), while framework-internal prep keys
      // (MASTRA_VERSIONS_KEY / MastraMemory / auth token) are excluded by key,
      // so persisted customContext still reflects only caller and processor
      // entries.
      const entries = (result.workflowInput as { requestContextEntries?: Record<string, unknown> })
        .requestContextEntries;
      expect(entries).toEqual({ userId: 'user-123', mastra__scopes: [] });
    });

    it('should not persist a delegating agent memory instance from the reserved key', async () => {
      const mockModel = createTextModel('Hello!');

      const baseAgent = new Agent({
        id: 'inherited-memory-snapshot-agent',
        name: 'Inherited Memory Snapshot Agent',
        instructions: 'Test inherited memory snapshot',
        model: mockModel as LanguageModelV2,
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const requestContext = new RequestContext();
      requestContext.set('userId', 'user-123');
      // Delegation puts a live MastraMemory instance here. It stringifies fine, so
      // without an explicit exclusion it would be persisted into the workflow input
      // and come back from resume as a method-less husk.
      requestContext.setRaw(MASTRA_INHERITED_MEMORY_KEY, new MockMemory());

      const result = await durableAgent.prepare('Hello', {
        requestContext,
      });

      const entries = (result.workflowInput as { requestContextEntries?: Record<string, unknown> })
        .requestContextEntries;
      expect(entries).toEqual({ userId: 'user-123', mastra__scopes: [] });
    });

    it('should not persist the framework-managed auth token into workflow input', async () => {
      const mockModel = createTextModel('Hello!');

      const baseAgent = new Agent({
        id: 'auth-token-snapshot-agent',
        name: 'Auth Token Snapshot Agent',
        instructions: 'Test auth token snapshot',
        model: mockModel as LanguageModelV2,
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const requestContext = new RequestContext();
      requestContext.set('userId', 'user-123');
      // Server auth middleware stores the raw bearer token here. It must never
      // be persisted into durable workflow input.
      requestContext.set(MASTRA_AUTH_TOKEN_KEY, 'super-secret-bearer-token');

      const result = await durableAgent.prepare('Hello', {
        requestContext,
      });

      const entries = (result.workflowInput as { requestContextEntries?: Record<string, unknown> })
        .requestContextEntries;
      expect(entries).toEqual({ userId: 'user-123', mastra__scopes: [] });
    });
  });
});
