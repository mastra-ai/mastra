import type { SpanRecord, TraceRecord } from '../../storage/index.js';
import type { ScorerRunInputForAgent, ScorerRunOutputForAgent } from '../types.js';
interface SpanTree {
    spanMap: Map<string, SpanRecord>;
    childrenMap: Map<string, SpanRecord[]>;
    rootSpans: SpanRecord[];
}
/**
 * Build a hierarchical span tree with efficient lookup maps
 */
export declare function buildSpanTree(spans: SpanRecord[]): SpanTree;
/**
 * Validate trace structure and throw descriptive errors
 */
export declare function validateTrace(trace: TraceRecord): void;
export declare function transformTraceToScorerInputAndOutput(trace: TraceRecord): {
    input: ScorerRunInputForAgent;
    output: ScorerRunOutputForAgent;
};
export {};
//# sourceMappingURL=utils.d.ts.map