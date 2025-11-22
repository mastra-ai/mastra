import { describe, it, expect } from 'vitest';
import { transformNetwork } from '../transformers';
import { NetworkChunkType, ChunkFrom } from '@mastra/core/stream';

describe('transformNetwork', () => {
  describe('routing agent text streaming', () => {
    it('should transform routing-agent-text-delta to text-delta', () => {
      const bufferedNetworks = new Map();
      bufferedNetworks.set('run-1', {
        name: 'routing-agent',
        steps: [],
        usage: null,
        output: null,
      });

      const chunk: NetworkChunkType = {
        type: 'routing-agent-text-delta',
        payload: { text: 'Hello from routing agent' },
        runId: 'run-1',
        from: ChunkFrom.NETWORK,
      };

      const result = transformNetwork(chunk, bufferedNetworks);

      expect(result).toEqual({
        type: 'text-delta',
        id: 'run-1',
        delta: 'Hello from routing agent',
      });
    });

    it('should transform routing-agent-text-start to text-start', () => {
      const bufferedNetworks = new Map();
      bufferedNetworks.set('run-1', {
        name: 'routing-agent',
        steps: [],
        usage: null,
        output: null,
      });

      const chunk: NetworkChunkType = {
        type: 'routing-agent-text-start',
        payload: { runId: 'run-1' },
        runId: 'run-1',
        from: ChunkFrom.NETWORK,
      };

      const result = transformNetwork(chunk, bufferedNetworks);

      expect(result).toEqual({
        type: 'text-start',
        id: 'run-1',
      });
    });
  });

  describe('sub-agent text streaming', () => {
    it('should transform agent-execution-event-text-delta to text-delta', () => {
      const bufferedNetworks = new Map();
      bufferedNetworks.set('run-1', {
        name: 'network',
        steps: [],
        usage: null,
        output: null,
      });

      const chunk: NetworkChunkType = {
        type: 'agent-execution-event-text-delta',
        payload: {
          type: 'text-delta',
          payload: { text: 'Hello from sub-agent' },
        } as any,
        runId: 'run-1',
        from: ChunkFrom.NETWORK,
      };

      const result = transformNetwork(chunk, bufferedNetworks);

      expect(result).toEqual({
        type: 'text-delta',
        id: 'run-1',
        delta: 'Hello from sub-agent',
      });
    });

    it('should transform agent-execution-event-text-start to text-start', () => {
      const bufferedNetworks = new Map();
      bufferedNetworks.set('run-1', {
        name: 'network',
        steps: [],
        usage: null,
        output: null,
      });

      const chunk: NetworkChunkType = {
        type: 'agent-execution-event-text-start',
        payload: {
          type: 'text-start',
        } as any,
        runId: 'run-1',
        from: ChunkFrom.NETWORK,
      };

      const result = transformNetwork(chunk, bufferedNetworks);

      expect(result).toEqual({
        type: 'text-start',
        id: 'run-1',
      });
    });
  });

  describe('sub-workflow text streaming', () => {
    it('should transform workflow-execution-event-text-delta to text-delta', () => {
      const bufferedNetworks = new Map();
      bufferedNetworks.set('run-1', {
        name: 'network',
        steps: [],
        usage: null,
        output: null,
      });

      const chunk: NetworkChunkType = {
        type: 'workflow-execution-event-text-delta',
        payload: {
          type: 'text-delta',
          payload: { text: 'Hello from sub-workflow' },
        } as any,
        runId: 'run-1',
        from: ChunkFrom.NETWORK,
      };

      const result = transformNetwork(chunk, bufferedNetworks);

      expect(result).toEqual({
        type: 'text-delta',
        id: 'run-1',
        delta: 'Hello from sub-workflow',
      });
    });

    it('should transform workflow-execution-event-text-start to text-start', () => {
      const bufferedNetworks = new Map();
      bufferedNetworks.set('run-1', {
        name: 'network',
        steps: [],
        usage: null,
        output: null,
      });

      const chunk: NetworkChunkType = {
        type: 'workflow-execution-event-text-start',
        payload: {
          type: 'text-start',
        } as any,
        runId: 'run-1',
        from: ChunkFrom.NETWORK,
      };

      const result = transformNetwork(chunk, bufferedNetworks);

      expect(result).toEqual({
        type: 'text-start',
        id: 'run-1',
      });
    });
  });

  describe('data chunks', () => {
    it('should pass through data chunks unchanged', () => {
      const bufferedNetworks = new Map();

      const chunk: NetworkChunkType = {
        type: 'agent-execution-event-data-custom',
        payload: {
          type: 'data-custom',
          data: { foo: 'bar' },
        } as any,
        runId: 'run-1',
        from: ChunkFrom.NETWORK,
      };

      const result = transformNetwork(chunk, bufferedNetworks);

      expect(result).toEqual({
        type: 'data-custom',
        data: { foo: 'bar' },
      });
    });
  });

  describe('other events', () => {
    it('should handle agent-execution-start', () => {
      const bufferedNetworks = new Map();
      bufferedNetworks.set('run-1', {
        name: 'network',
        steps: [],
        usage: null,
        output: null,
      });

      const chunk: NetworkChunkType = {
        type: 'agent-execution-start',
        payload: {
          agentId: 'test-agent',
          args: {
            task: 'test',
            primitiveId: 'test-agent',
            primitiveType: 'agent',
            prompt: 'test prompt',
            result: '',
            selectionReason: 'test reason',
            iteration: 0,
          },
          runId: 'run-1',
        },
        runId: 'run-1',
        from: ChunkFrom.NETWORK,
      };

      const result = transformNetwork(chunk, bufferedNetworks);

      expect(result).toHaveProperty('type', 'data-network');
      expect(result).toHaveProperty('id', 'run-1');
      expect((result as any).data.steps).toHaveLength(1);
      expect((result as any).data.steps[0].name).toBe('test-agent');
    });
  });
});
