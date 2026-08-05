import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { encode } from '../../events/codec';
import { createRunScope } from '../../mastra/run-scope';
import {
  AGENT_KEY,
  BACKGROUND_TASK_MANAGER_KEY,
  DRAIN_PENDING_SIGNALS_KEY,
  MEMORY_KEY,
  SAVE_QUEUE_MANAGER_KEY,
  STEP_TOOLS_KEY,
  TRANSPORT_REF_KEY,
} from '../run-scope-keys';
import { llmIterationOutputSchema, llmIterationStepResultSchema, toolCallOutputSchema } from './schema';

/**
 * Serialization invariants for the agentic-execution and agentic-loop workflows.
 *
 * The evented engine routes step outputs through `JSON.stringify` (storage
 * snapshots, `UnixSocketPubSub` frames). Anything described by a step's
 * `outputSchema` MUST be JSON-safe — class instances with non-trivial state,
 * `Map`s, closures, and live runtime handles must live on the per-run RunScope
 * instead.
 *
 * Date/Error/Map/Set/GeneratedFile values that genuinely need to travel are
 * handled by the codec at the `UnixSocketPubSub` boundary. Live handles
 * (SaveQueueManager, BackgroundTaskManager, MastraMemory, ToolSet with execute
 * closures, StreamTransportRef, …) and bare functions are not — those stay in
 * the runScope and are guarded by the tests below.
 */
describe('agentic-execution / agentic-loop serialization invariants', () => {
  describe('step output schemas do not advertise non-serializable handles', () => {
    const forbiddenKeys = [
      'agent',
      'saveQueueManager',
      'backgroundTaskManager',
      'memory',
      'transportRef',
      'stepTools',
      'stepActiveTools',
      'stepWorkspace',
      'drainPendingSignals',
      'agentBackgroundConfig',
      'backgroundTaskManagerConfig',
      // pure functions never belong on the wire
      'now',
      'generateId',
      'currentDate',
      // memory configuration that holds processor instances
      'memoryConfig',
    ];

    function collectKeys(schema: z.ZodTypeAny): Set<string> {
      const found = new Set<string>();
      const visit = (s: z.ZodTypeAny) => {
        if (!s || typeof s !== 'object') return;
        if (s instanceof z.ZodObject) {
          const shape = (s as z.ZodObject<any>).shape;
          for (const [k, v] of Object.entries(shape)) {
            found.add(k);
            visit(v as z.ZodTypeAny);
          }
          return;
        }
        // Unwrap common wrappers — visit every child container so composite
        // nodes (unions, intersections, tuples, records) are fully traversed.
        const def = (s as any)._def ?? (s as any).def;
        if (!def) return;
        const children: unknown[] = [
          def.innerType,
          def.schema,
          def.type,
          def.element,
          def.valueType,
          def.keyType,
          def.left,
          def.right,
          def.options,
          def.items,
        ];
        for (const child of children) {
          if (Array.isArray(child)) {
            for (const i of child) visit(i as z.ZodTypeAny);
          } else if (child) {
            visit(child as z.ZodTypeAny);
          }
        }
      };
      visit(schema);
      return found;
    }

    it('llmIterationOutputSchema does not include forbidden handle keys', () => {
      const keys = collectKeys(llmIterationOutputSchema);
      for (const banned of forbiddenKeys) {
        expect(keys.has(banned), `forbidden key "${banned}" found in llmIterationOutputSchema`).toBe(false);
      }
    });

    it('llmIterationStepResultSchema does not include forbidden handle keys', () => {
      const keys = collectKeys(llmIterationStepResultSchema);
      for (const banned of forbiddenKeys) {
        expect(keys.has(banned), `forbidden key "${banned}" found in llmIterationStepResultSchema`).toBe(false);
      }
    });

    it('toolCallOutputSchema does not include forbidden handle keys', () => {
      const keys = collectKeys(toolCallOutputSchema);
      for (const banned of forbiddenKeys) {
        expect(keys.has(banned), `forbidden key "${banned}" found in toolCallOutputSchema`).toBe(false);
      }
    });
  });

  describe('runScope carries the values that must stay off the wire', () => {
    it('Agent / SaveQueueManager / BackgroundTaskManager / Memory / TransportRef live on runScope', () => {
      const scope = createRunScope();
      const agent = { id: 'agent', generate: () => {} };
      const saveQueueManager = { flushMessages: () => {} };
      const backgroundTaskManager = { run: () => {} };
      const memory = { rememberMessages: () => [] };
      const transportRef = { current: null };

      scope.set(AGENT_KEY, agent as any);
      scope.set(SAVE_QUEUE_MANAGER_KEY, saveQueueManager as any);
      scope.set(BACKGROUND_TASK_MANAGER_KEY, backgroundTaskManager as any);
      scope.set(MEMORY_KEY, memory as any);
      scope.set(TRANSPORT_REF_KEY, transportRef as any);

      // Live references preserved with their method closures intact.
      expect(scope.getOrThrow(AGENT_KEY)).toBe(agent);
      expect(scope.getOrThrow(SAVE_QUEUE_MANAGER_KEY)).toBe(saveQueueManager);
      expect(scope.getOrThrow(BACKGROUND_TASK_MANAGER_KEY)).toBe(backgroundTaskManager);
      expect(scope.getOrThrow(MEMORY_KEY)).toBe(memory);
      expect(scope.getOrThrow(TRANSPORT_REF_KEY)).toBe(transportRef);
    });

    it('STEP_TOOLS keeps live `execute` closures by reference', () => {
      const scope = createRunScope();
      const tool = { description: 't', execute: () => 'ran' } as any;
      const tools = { search: tool };
      scope.set(STEP_TOOLS_KEY, tools as any);

      const stored = scope.get(STEP_TOOLS_KEY) as Record<string, any>;
      expect(stored.search).toBe(tool);
      expect(stored.search.execute()).toBe('ran');
    });

    it('DRAIN_PENDING_SIGNALS holds a function, which would be lost via JSON', () => {
      const scope = createRunScope();
      const drain = () => [{ id: 'sig' } as any];
      scope.set(DRAIN_PENDING_SIGNALS_KEY, drain);

      const stored = scope.getOrThrow(DRAIN_PENDING_SIGNALS_KEY);
      expect(stored).toBe(drain);
      expect(stored('run-id')).toEqual([{ id: 'sig' }]);
    });
  });

  describe('codec at the wire boundary does not see runScope handles', () => {
    it('encoding a representative iteration output never tags a Class or Function envelope', () => {
      const sample = {
        messageId: 'msg-1',
        messages: { all: [], user: [], nonUser: [] },
        output: {
          text: 'hi',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          steps: [],
        },
        metadata: { timestamp: new Date(0) },
        stepResult: {
          reason: 'stop',
          warnings: [],
          isContinued: false,
          totalUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        },
      };

      const encoded = JSON.stringify(encode(sample));
      // Date is expected to be tagged; class/function envelopes would indicate a leak.
      expect(encoded).not.toContain('"__m_codec__":"Class"');
      expect(encoded).not.toContain('"__m_codec__":"Function"');
    });
  });
});
