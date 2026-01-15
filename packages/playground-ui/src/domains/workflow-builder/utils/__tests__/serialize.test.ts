import { describe, it, expect } from 'vitest';
import { serializeGraph, serializeGraphFull } from '../serialize';
import { deserializeDefinition } from '../deserialize';
import type { BuilderNode, BuilderEdge } from '../../types';
import { createTriggerNodeData, createAgentNodeData, createToolNodeData, createConditionNodeData } from '../../types';
import type { StorageWorkflowDefinitionType } from '@mastra/core/storage';

describe('serialize/deserialize round-trip', () => {
  describe('serializeGraph', () => {
    it('should serialize a simple workflow with trigger and agent', () => {
      const nodes: BuilderNode[] = [
        {
          id: 'trigger',
          type: 'trigger',
          position: { x: 0, y: 0 },
          data: createTriggerNodeData(),
        },
        {
          id: 'agent-1',
          type: 'agent',
          position: { x: 0, y: 150 },
          data: {
            ...createAgentNodeData('Agent Step'),
            agentId: 'test-agent',
            prompt: { $ref: 'input.prompt' },
          },
        },
      ];

      const edges: BuilderEdge[] = [
        {
          id: 'e-trigger-agent-1',
          source: 'trigger',
          target: 'agent-1',
          type: 'data',
        },
      ];

      const result = serializeGraph(nodes, edges);

      expect(result.steps).toHaveProperty('agent-1');
      expect(result.steps['agent-1']).toEqual({
        type: 'agent',
        agentId: 'test-agent',
        input: {
          prompt: { $ref: 'input.prompt' },
        },
      });
      expect(result.stepGraph).toHaveLength(1);
      expect(result.stepGraph[0]).toEqual({
        type: 'step',
        step: {
          id: 'agent-1',
          description: undefined,
        },
      });
    });

    it('should serialize a workflow with tool node', () => {
      const nodes: BuilderNode[] = [
        {
          id: 'trigger',
          type: 'trigger',
          position: { x: 0, y: 0 },
          data: createTriggerNodeData(),
        },
        {
          id: 'tool-1',
          type: 'tool',
          position: { x: 0, y: 150 },
          data: {
            ...createToolNodeData('Tool Step'),
            toolId: 'test-tool',
            input: {
              query: { $ref: 'input.query' },
            },
          },
        },
      ];

      const edges: BuilderEdge[] = [
        {
          id: 'e-trigger-tool-1',
          source: 'trigger',
          target: 'tool-1',
          type: 'data',
        },
      ];

      const result = serializeGraph(nodes, edges);

      expect(result.steps).toHaveProperty('tool-1');
      expect(result.steps['tool-1']).toEqual({
        type: 'tool',
        toolId: 'test-tool',
        input: {
          query: { $ref: 'input.query' },
        },
      });
    });
  });

  describe('deserializeDefinition', () => {
    it('should deserialize a simple workflow definition', () => {
      const definition: StorageWorkflowDefinitionType = {
        id: 'test-workflow',
        name: 'Test Workflow',
        description: 'A test workflow',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: { type: 'string' },
          },
        },
        outputSchema: {},
        stepGraph: [
          {
            type: 'step',
            step: { id: 'agent-1' },
          },
        ],
        steps: {
          'agent-1': {
            type: 'agent',
            agentId: 'test-agent',
            input: {
              prompt: { $ref: 'input.prompt' },
            },
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = deserializeDefinition(definition);

      // Should have trigger node + agent node
      expect(result.nodes).toHaveLength(2);
      expect(result.nodes[0].data.type).toBe('trigger');
      expect(result.nodes[1].data.type).toBe('agent');

      // Should have edge from trigger to agent
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].source).toBe('trigger');
      expect(result.edges[0].target).toBe('agent-1');
      expect(result.edges[0].type).toBe('data');
    });

    it('should deserialize conditional workflows', () => {
      const definition: StorageWorkflowDefinitionType = {
        id: 'conditional-workflow',
        name: 'Conditional Workflow',
        inputSchema: {},
        outputSchema: {},
        stepGraph: [
          {
            type: 'conditional',
            branches: [
              {
                condition: {
                  type: 'compare',
                  field: { $ref: 'input.value' },
                  operator: 'gt',
                  value: { $literal: 10 },
                },
                stepId: 'agent-yes',
              },
            ],
            default: 'agent-no',
          },
        ],
        steps: {
          'agent-yes': {
            type: 'agent',
            agentId: 'yes-agent',
            input: { prompt: { $ref: 'input.prompt' } },
          },
          'agent-no': {
            type: 'agent',
            agentId: 'no-agent',
            input: { prompt: { $ref: 'input.prompt' } },
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = deserializeDefinition(definition);

      // Should have trigger + condition + 2 agents = 4 nodes
      expect(result.nodes).toHaveLength(4);

      const conditionNode = result.nodes.find(n => n.data.type === 'condition');
      expect(conditionNode).toBeDefined();

      // All edges should have type: 'data'
      for (const edge of result.edges) {
        expect(edge.type).toBe('data');
      }
    });
  });

  describe('round-trip', () => {
    it('should maintain structure through serialize -> deserialize cycle', () => {
      // Create a workflow with nodes and edges
      const originalNodes: BuilderNode[] = [
        {
          id: 'trigger',
          type: 'trigger',
          position: { x: 0, y: 0 },
          data: createTriggerNodeData(),
        },
        {
          id: 'agent-1',
          type: 'agent',
          position: { x: 0, y: 150 },
          data: {
            ...createAgentNodeData('Process Input'),
            agentId: 'processor-agent',
            prompt: { $ref: 'input.prompt' },
          },
        },
        {
          id: 'tool-1',
          type: 'tool',
          position: { x: 0, y: 300 },
          data: {
            ...createToolNodeData('Fetch Data'),
            toolId: 'fetch-tool',
            input: {
              query: { $ref: 'steps.agent-1.result' },
            },
          },
        },
      ];

      const originalEdges: BuilderEdge[] = [
        {
          id: 'e-trigger-agent-1',
          source: 'trigger',
          target: 'agent-1',
          type: 'data',
        },
        {
          id: 'e-agent-1-tool-1',
          source: 'agent-1',
          target: 'tool-1',
          type: 'data',
        },
      ];

      // Serialize
      const serialized = serializeGraphFull(originalNodes, originalEdges, {
        id: 'test-workflow',
        name: 'Test Workflow',
        inputSchema: { type: 'object', properties: { prompt: { type: 'string' } } },
        outputSchema: {},
      });

      // Deserialize
      const deserialized = deserializeDefinition({
        ...serialized,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as StorageWorkflowDefinitionType);

      // Verify structure is preserved
      expect(deserialized.nodes).toHaveLength(originalNodes.length);
      expect(deserialized.edges).toHaveLength(originalEdges.length);

      // Verify node types are preserved
      const originalTypes = new Set(originalNodes.map(n => n.data.type));
      const deserializedTypes = new Set(deserialized.nodes.map(n => n.data.type));
      expect(deserializedTypes).toEqual(originalTypes);

      // Verify all edges have type: 'data'
      for (const edge of deserialized.edges) {
        expect(edge.type).toBe('data');
      }
    });
  });
});
