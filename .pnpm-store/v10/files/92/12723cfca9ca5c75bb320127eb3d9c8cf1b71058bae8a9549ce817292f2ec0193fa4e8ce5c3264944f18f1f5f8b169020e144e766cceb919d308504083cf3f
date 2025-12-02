import { OperationNodeSource } from '../operation-node/operation-node-source.js';
import { SimpleReferenceExpressionNode } from '../operation-node/simple-reference-expression-node.js';
export declare class DynamicReferenceBuilder<R extends string = never> implements OperationNodeSource {
    #private;
    get dynamicReference(): string;
    /**
     * @private
     *
     * This needs to be here just so that the typings work. Without this
     * the generated .d.ts file contains no reference to the type param R
     * which causes this type to be equal to DynamicReferenceBuilder with
     * any R.
     */
    protected get refType(): R;
    constructor(reference: string);
    toOperationNode(): SimpleReferenceExpressionNode;
}
export declare function isDynamicReferenceBuilder(obj: unknown): obj is DynamicReferenceBuilder<any>;
