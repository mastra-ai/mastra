/**
 * TODO: GraphRAG Enhancements
 *  - Add support for more edge types (sequential, hierarchical, citation, etc)
 *  - Allow for custom edge types
 *  - Utilize metadata for richer connections
 *  - Improve graph traversal and querying using types
 */
type SupportedEdgeType = 'semantic';
export interface GraphNode {
    id: string;
    content: string;
    embedding?: number[];
    metadata?: Record<string, any>;
}
export interface RankedNode extends GraphNode {
    score: number;
}
export interface GraphEdge {
    source: string;
    target: string;
    weight: number;
    type: SupportedEdgeType;
}
export interface GraphChunk {
    text: string;
    metadata: Record<string, any>;
}
export interface GraphEmbedding {
    vector: number[];
}
export declare class GraphRAG {
    private nodes;
    private edges;
    private dimension;
    private threshold;
    constructor(dimension?: number, threshold?: number);
    addNode(node: GraphNode): void;
    addEdge(edge: GraphEdge): void;
    getNodes(): GraphNode[];
    getEdges(): GraphEdge[];
    getEdgesByType(type: string): GraphEdge[];
    clear(): void;
    updateNodeContent(id: string, newContent: string): void;
    private getNeighbors;
    private cosineSimilarity;
    createGraph(chunks: GraphChunk[], embeddings: GraphEmbedding[]): void;
    private selectWeightedNeighbor;
    private randomWalkWithRestart;
    query({ query, topK, randomWalkSteps, restartProb, }: {
        query: number[];
        topK?: number;
        randomWalkSteps?: number;
        restartProb?: number;
    }): RankedNode[];
}
export {};
//# sourceMappingURL=index.d.ts.map