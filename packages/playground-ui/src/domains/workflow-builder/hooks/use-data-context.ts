import { useMemo } from 'react';
import { useWorkflowBuilderStore } from '../store/workflow-builder-store';
import type { BuilderNode, BuilderEdge, BuilderNodeType } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface DataField {
  name: string;
  path: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'unknown';
  description?: string;
  required?: boolean;
  nested?: DataField[];
}

export interface DataSource {
  id: string;
  label: string;
  nodeType: BuilderNodeType;
  refPrefix: string;
  fields: DataField[];
  color: string;
}

export interface DataContext {
  /** All available data sources for a given node */
  sources: DataSource[];
  /** Flat list of all available paths for autocomplete */
  allPaths: { path: string; label: string; type: string; source: string }[];
  /** Get a specific source by ID */
  getSource: (id: string) => DataSource | undefined;
  /** Check if a reference path is valid */
  isValidPath: (path: string) => boolean;
}

// ============================================================================
// Node Output Schema Inference
// ============================================================================

/**
 * Infers the output schema/fields for a given node type.
 * This is used to populate what data downstream nodes can reference.
 */
function inferNodeOutputFields(node: BuilderNode): DataField[] {
  const { type } = node.data;

  switch (type) {
    case 'trigger':
      // Trigger outputs come from the workflow's input schema
      // This is handled separately via inputSchema
      return [];

    case 'agent':
      return [
        { name: 'text', path: 'text', type: 'string', description: 'Generated text response' },
        { name: 'toolCalls', path: 'toolCalls', type: 'array', description: 'Tool calls made by agent' },
        { name: 'usage', path: 'usage', type: 'object', description: 'Token usage statistics' },
      ];

    case 'tool':
      // Tool outputs depend on the specific tool - for now return generic output
      return [{ name: 'result', path: 'result', type: 'unknown', description: 'Tool execution result' }];

    case 'condition':
      // Conditions don't produce output, they route
      return [];

    case 'parallel':
      // Parallel outputs are the combined results of all branches
      return [{ name: 'results', path: 'results', type: 'object', description: 'Combined branch results' }];

    case 'loop':
      return [
        { name: 'iterations', path: 'iterations', type: 'array', description: 'Results from each iteration' },
        { name: 'lastResult', path: 'lastResult', type: 'unknown', description: 'Result from final iteration' },
      ];

    case 'foreach':
      return [
        { name: 'results', path: 'results', type: 'array', description: 'Results for each item' },
        { name: 'count', path: 'count', type: 'number', description: 'Number of items processed' },
      ];

    case 'transform':
      // Transform outputs are defined by the user in the config
      const transformData = node.data as { output?: Record<string, unknown> };
      if (transformData.output) {
        return Object.keys(transformData.output).map(key => ({
          name: key,
          path: key,
          type: 'unknown' as const,
          description: `Transformed field: ${key}`,
        }));
      }
      return [];

    case 'suspend':
      // Suspend outputs come from the resume schema
      const suspendData = node.data as { resumeSchema?: { properties?: Record<string, unknown> } };
      if (suspendData.resumeSchema?.properties) {
        return Object.keys(suspendData.resumeSchema.properties).map(key => ({
          name: key,
          path: key,
          type: 'unknown' as const,
          description: `Human input: ${key}`,
        }));
      }
      return [{ name: 'input', path: 'input', type: 'unknown', description: 'Human-provided input' }];

    case 'workflow':
      // Sub-workflow outputs depend on that workflow's output schema
      return [{ name: 'result', path: 'result', type: 'unknown', description: 'Sub-workflow result' }];

    case 'sleep':
      // Sleep doesn't produce meaningful output
      return [{ name: 'resumedAt', path: 'resumedAt', type: 'string', description: 'Timestamp when resumed' }];

    case 'agent-network':
      return [
        { name: 'response', path: 'response', type: 'string', description: 'Final network response' },
        { name: 'agentHistory', path: 'agentHistory', type: 'array', description: 'Conversation between agents' },
        {
          name: 'selectedAgent',
          path: 'selectedAgent',
          type: 'string',
          description: 'Agent that provided final answer',
        },
      ];

    default:
      return [];
  }
}

/**
 * Gets the color associated with a node type
 */
function getNodeColor(type: BuilderNodeType): string {
  const colors: Record<BuilderNodeType, string> = {
    trigger: '#22c55e',
    agent: '#3b82f6',
    tool: '#a855f7',
    condition: '#eab308',
    parallel: '#06b6d4',
    loop: '#f97316',
    foreach: '#ec4899',
    transform: '#14b8a6',
    suspend: '#ef4444',
    workflow: '#6366f1',
    sleep: '#6b7280',
    'agent-network': '#8b5cf6',
  };
  return colors[type] || '#6b7280';
}

// ============================================================================
// Graph Traversal
// ============================================================================

/**
 * Gets all predecessor node IDs (nodes that can flow data to the target)
 */
function getPredecessors(nodeId: string, nodes: BuilderNode[], edges: BuilderEdge[]): string[] {
  const predecessors: string[] = [];
  const visited = new Set<string>();

  // Build reverse adjacency list
  const reverseAdj = new Map<string, string[]>();
  for (const edge of edges) {
    if (!reverseAdj.has(edge.target)) {
      reverseAdj.set(edge.target, []);
    }
    reverseAdj.get(edge.target)!.push(edge.source);
  }

  // BFS to find all predecessors
  const queue = [nodeId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const sources = reverseAdj.get(current) || [];
    for (const source of sources) {
      if (!visited.has(source)) {
        predecessors.push(source);
        queue.push(source);
      }
    }
  }

  return predecessors;
}

// ============================================================================
// Schema to Fields Conversion
// ============================================================================

/**
 * Converts a JSON schema to DataField array
 */
function schemaToFields(schema: Record<string, unknown>, prefix: string = ''): DataField[] {
  const properties = schema.properties as Record<string, unknown> | undefined;
  const required = (schema.required as string[]) || [];

  if (!properties) return [];

  return Object.entries(properties).map(([name, propSchema]) => {
    const prop = propSchema as Record<string, unknown>;
    const path = prefix ? `${prefix}.${name}` : name;
    const type = inferTypeFromSchema(prop);

    const field: DataField = {
      name,
      path,
      type,
      description: prop.description as string | undefined,
      required: required.includes(name),
    };

    // Handle nested objects
    if (type === 'object' && prop.properties) {
      field.nested = schemaToFields(prop as Record<string, unknown>, path);
    }

    // Handle array items
    if (type === 'array' && prop.items) {
      const items = prop.items as Record<string, unknown>;
      if (items.properties) {
        field.nested = schemaToFields(items, `${path}[]`);
      }
    }

    return field;
  });
}

function inferTypeFromSchema(schema: Record<string, unknown>): DataField['type'] {
  const schemaType = schema.type as string | undefined;
  switch (schemaType) {
    case 'string':
      return 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'object':
      return 'object';
    case 'array':
      return 'array';
    default:
      return 'unknown';
  }
}

// ============================================================================
// Flatten Fields for Autocomplete
// ============================================================================

function flattenFields(
  fields: DataField[],
  sourceId: string,
  sourceLabel: string,
  refPrefix: string,
): { path: string; label: string; type: string; source: string }[] {
  const result: { path: string; label: string; type: string; source: string }[] = [];

  function traverse(fields: DataField[], parentPath: string) {
    for (const field of fields) {
      const fullPath = `${refPrefix}.${field.path}`;
      result.push({
        path: fullPath,
        label: `${sourceLabel} > ${field.name}`,
        type: field.type,
        source: sourceId,
      });

      if (field.nested) {
        traverse(field.nested, fullPath);
      }
    }
  }

  traverse(fields, refPrefix);
  return result;
}

// ============================================================================
// Main Hook
// ============================================================================

/**
 * Hook to compute the available data context for a specific node.
 * Returns all data sources that can be referenced from the selected node.
 */
export function useDataContext(nodeId: string | null): DataContext {
  const nodes = useWorkflowBuilderStore(state => state.nodes);
  const edges = useWorkflowBuilderStore(state => state.edges);
  const inputSchema = useWorkflowBuilderStore(state => state.inputSchema);

  return useMemo(() => {
    if (!nodeId) {
      return {
        sources: [],
        allPaths: [],
        getSource: () => undefined,
        isValidPath: () => false,
      };
    }

    const sources: DataSource[] = [];
    const allPaths: { path: string; label: string; type: string; source: string }[] = [];

    // Add trigger/input as a source
    const triggerFields = schemaToFields(inputSchema);
    if (triggerFields.length > 0) {
      const triggerSource: DataSource = {
        id: 'trigger',
        label: 'Trigger Input',
        nodeType: 'trigger',
        refPrefix: 'trigger',
        fields: triggerFields,
        color: getNodeColor('trigger'),
      };
      sources.push(triggerSource);
      allPaths.push(...flattenFields(triggerFields, 'trigger', 'Trigger', 'trigger'));
    }

    // Get all predecessor nodes
    const predecessorIds = getPredecessors(nodeId, nodes, edges);
    const predecessorNodes = nodes.filter(n => predecessorIds.includes(n.id) && n.data.type !== 'trigger');

    // Add each predecessor as a data source
    for (const predNode of predecessorNodes) {
      const fields = inferNodeOutputFields(predNode);
      if (fields.length > 0) {
        const source: DataSource = {
          id: predNode.id,
          label: predNode.data.label || `Step ${predNode.id.slice(0, 6)}`,
          nodeType: predNode.data.type as BuilderNodeType,
          refPrefix: `steps.${predNode.id}`,
          fields,
          color: getNodeColor(predNode.data.type as BuilderNodeType),
        };
        sources.push(source);
        allPaths.push(...flattenFields(fields, predNode.id, source.label, source.refPrefix));
      }
    }

    // Create lookup maps
    const sourceMap = new Map(sources.map(s => [s.id, s]));
    const pathSet = new Set(allPaths.map(p => p.path));

    return {
      sources,
      allPaths,
      getSource: (id: string) => sourceMap.get(id),
      isValidPath: (path: string) => {
        // Check exact match
        if (pathSet.has(path)) return true;
        // Check if it's a prefix of any valid path (for nested access)
        for (const validPath of pathSet) {
          if (validPath.startsWith(path + '.')) return true;
        }
        return false;
      },
    };
  }, [nodeId, nodes, edges, inputSchema]);
}

/**
 * Hook to get the data context for the currently selected node
 */
export function useSelectedNodeDataContext(): DataContext {
  const selectedNodeId = useWorkflowBuilderStore(state => state.selectedNodeId);
  return useDataContext(selectedNodeId);
}
