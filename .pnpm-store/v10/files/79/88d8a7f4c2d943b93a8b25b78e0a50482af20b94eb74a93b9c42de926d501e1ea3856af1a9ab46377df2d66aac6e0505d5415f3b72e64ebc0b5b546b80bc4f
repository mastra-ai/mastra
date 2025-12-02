import { OperationNodeSource } from '../operation-node/operation-node-source.js';
import { CommonTableExpressionNode } from '../operation-node/common-table-expression-node.js';
export declare class CTEBuilder<N extends string> implements OperationNodeSource {
    #private;
    constructor(props: CTEBuilderProps);
    /**
     * Makes the common table expression materialized.
     */
    materialized(): CTEBuilder<N>;
    /**
     * Makes the common table expression not materialized.
     */
    notMaterialized(): CTEBuilder<N>;
    toOperationNode(): CommonTableExpressionNode;
}
interface CTEBuilderProps {
    readonly node: CommonTableExpressionNode;
}
export type CTEBuilderCallback<N extends string> = (cte: <N2 extends string>(name: N2) => CTEBuilder<N2>) => CTEBuilder<N>;
export {};
