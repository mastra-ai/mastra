# Knowledge Graphs for Skills & Knowledge

Design exploration for adding knowledge graph functionality to Mastra's skills and knowledge primitives.

Based on closed PR: https://github.com/mastra-ai/mastra/pull/11444

## Overview

Knowledge graphs provide a structured way to represent relationships between entities. This could enhance both Skills and Knowledge:

- **Skills**: Model dependencies, related concepts, and skill hierarchies
- **Knowledge**: Connect artifacts with semantic relationships, enable graph-based retrieval

## Core Data Model

### Nodes

```typescript
interface KnowledgeNode {
  id: string;
  type: string; // e.g., 'document', 'concept', 'skill'
  labels?: string[]; // Additional categorization
  properties?: Record<string, unknown>;
  embedding?: number[]; // For similarity search
  createdAt?: string;
  updatedAt?: string;
  parentId?: string; // Hierarchical relationships
  childIds?: string[];
}
```

### Edges

```typescript
type SupportedEdgeType = 'semantic' | 'structural' | 'temporal' | 'causal';

interface KnowledgeEdge {
  id: string;
  source: string; // Source node ID
  target: string; // Target node ID
  type: string; // Relationship type
  supportedEdgeType?: SupportedEdgeType;
  weight?: number; // Relationship strength
  directed?: boolean; // Directed or bidirectional
  properties?: Record<string, unknown>;
}
```

### Edge Types

| Type         | Description                  | Example                               |
| ------------ | ---------------------------- | ------------------------------------- |
| `semantic`   | Meaning-based similarity     | "password-reset" ↔ "account-recovery" |
| `structural` | Document/hierarchy structure | Parent skill → Child skill            |
| `temporal`   | Time-based ordering          | v1.0 → v2.0                           |
| `causal`     | Cause-effect relationships   | Error → Resolution                    |

## Graph Operations

### Node Management

```typescript
class KnowledgeGraph {
  // Basic CRUD
  addNode(node: KnowledgeNode): void;
  addNodes(nodes: KnowledgeNode[]): void;
  updateNode(id: string, updates: Partial<KnowledgeNode>): void;
  removeNode(id: string): void;
  getNode(id: string): KnowledgeNode | undefined;

  // Queries
  findNodesByType(type: string): KnowledgeNode[];
  findNodesByLabel(label: string): KnowledgeNode[];
  filterNodesByProperty(key: string, value: unknown): KnowledgeNode[];
}
```

### Edge Management

```typescript
class KnowledgeGraph {
  addEdge(edge: KnowledgeEdge): void;
  addEdges(edges: KnowledgeEdge[]): void;
  removeEdge(id: string): void;
  getEdgesByType(type: string): KnowledgeEdge[];
}
```

### Graph Traversal

```typescript
class KnowledgeGraph {
  // Get connected nodes
  getNeighbors(nodeId: string): KnowledgeNode[];
  getNeighborInfo(nodeId: string, edgeType?: string): { id: string; weight: number }[];

  // Path finding
  findPath(sourceId: string, targetId: string): KnowledgeNode[];
  getSubgraph(nodeIds: string[]): KnowledgeGraph;
}
```

## Building Graphs from Content

### From Document Chunks

```typescript
interface GraphChunk {
  id?: string;
  text?: string;
  embedding?: number[];
  metadata: Record<string, unknown>;
}

// Edge creation strategies
type EdgeStrategy =
  | { strategy: 'cosine'; threshold?: number } // Similarity-based
  | { strategy: 'explicit'; edges: KnowledgeEdge[] } // Manual edges
  | { strategy: 'callback'; callback: (a, b) => boolean }; // Custom logic

graph.addNodesFromChunks({
  chunks: documentChunks,
  edgeOptions: { strategy: 'cosine', threshold: 0.7 },
  nodeType: 'document',
});
```

### From Skills

```typescript
// Build graph from skill directory
async function buildSkillGraph(skills: Skills): Promise<KnowledgeGraph> {
  const graph = new KnowledgeGraph({ name: 'skill-graph' });

  for (const skill of skills.list()) {
    // Add skill as node
    graph.addNode({
      id: skill.name,
      type: 'skill',
      labels: skill.tags,
      properties: {
        description: skill.description,
        version: skill.version,
      },
    });

    // Add edges for related skills (by tags)
    // Add edges for skill dependencies
  }

  return graph;
}
```

## Graph-Based Retrieval

### Random Walk Reranking

Enhance search results by considering graph structure:

```typescript
interface QueryOptions {
  query: number[]; // Query embedding
  topK?: number; // Number of results
  randomWalkSteps?: number; // Graph exploration depth
  restartProb?: number; // Random walk restart probability
}

// Query returns nodes ranked by both similarity and graph centrality
const results = await graph.query({
  query: queryEmbedding,
  topK: 5,
  randomWalkSteps: 10,
  restartProb: 0.15,
});
```

### Multi-Hop Retrieval

Find related content through graph connections:

```typescript
// Find documents related to a query through 2 hops
async function multiHopRetrieval(graph: KnowledgeGraph, startNode: string, hops: number = 2): Promise<KnowledgeNode[]> {
  const visited = new Set<string>();
  let frontier = [startNode];

  for (let i = 0; i < hops; i++) {
    const nextFrontier: string[] = [];
    for (const nodeId of frontier) {
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      const neighbors = graph.getNeighbors(nodeId);
      nextFrontier.push(...neighbors.map(n => n.id));
    }
    frontier = nextFrontier;
  }

  return Array.from(visited)
    .map(id => graph.getNode(id))
    .filter(Boolean);
}
```

## Integration with Current Primitives

### Skills + Graph

```typescript
// Skill with graph-based related skills
const skill = skills.get('code-review');
const related = await skillGraph.getNeighbors(skill.name);
// Returns: ['api-design', 'testing-guidelines', ...]
```

### Knowledge + Graph

```typescript
// Knowledge search enhanced with graph
const knowledge = new Knowledge({
  id: 'support-knowledge',
  storage: new KnowledgeFilesystemStorage({ paths: [...] }),
  bm25: true,
  graph: true, // Enable graph-based relationships
});

// Search considers both BM25 scores and graph relationships
const results = await knowledge.search('default', 'password reset', {
  mode: 'hybrid', // BM25 + graph
  graphHops: 2,
});
```

## Potential Use Cases

### 1. Skill Dependencies

```
┌─────────────┐     requires      ┌─────────────┐
│ api-design  │ ──────────────→ │ code-review │
└─────────────┘                   └─────────────┘
       │
       │ requires
       ▼
┌─────────────┐
│  security   │
└─────────────┘
```

### 2. Knowledge Concept Map

```
┌──────────────┐   related_to   ┌──────────────┐
│password-reset│ ←────────────→ │account-locked│
└──────────────┘                └──────────────┘
       │                              │
       │ solves                       │ causes
       ▼                              ▼
┌──────────────┐                ┌──────────────┐
│login-issues  │                │  2fa-setup   │
└──────────────┘                └──────────────┘
```

### 3. Document Similarity Graph

```
      ┌─────────┐
      │  Doc A  │
      └────┬────┘
           │ 0.85
     ┌─────┴─────┐
     │           │
     ▼           ▼
┌─────────┐ ┌─────────┐
│  Doc B  │─│  Doc C  │  (0.72)
└─────────┘ └─────────┘
```

## Open Questions

1. **Storage**: Where to persist graph data? Separate from knowledge artifacts?
2. **Embeddings**: Required for all nodes or optional?
3. **Edge creation**: Automatic (cosine similarity) or manual?
4. **Scale**: How to handle large graphs efficiently?
5. **Serialization**: JSON export/import for graph data?

## Related Documents

- [AGENT_SKILLS_SPEC.md](./AGENT_SKILLS_SPEC.md) - Agent Skills specification
- [VERSIONING_DESIGN.md](./VERSIONING_DESIGN.md) - Versioning system design
