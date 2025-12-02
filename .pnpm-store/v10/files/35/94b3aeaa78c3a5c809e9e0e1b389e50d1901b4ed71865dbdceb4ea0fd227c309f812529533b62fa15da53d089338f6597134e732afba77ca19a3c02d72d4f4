import { OperationNode } from './operation-node.js';
import { WhenNode } from './when-node.js';
export interface CaseNode extends OperationNode {
    readonly kind: 'CaseNode';
    readonly value?: OperationNode;
    readonly when?: ReadonlyArray<WhenNode>;
    readonly else?: OperationNode;
    readonly isStatement?: boolean;
}
/**
 * @internal
 */
export declare const CaseNode: Readonly<{
    is(node: OperationNode): node is CaseNode;
    create(value?: OperationNode): CaseNode;
    cloneWithWhen(caseNode: CaseNode, when: WhenNode): CaseNode;
    cloneWithThen(caseNode: CaseNode, then: OperationNode): CaseNode;
    cloneWith(caseNode: CaseNode, props: Partial<Pick<CaseNode, "else" | "isStatement">>): CaseNode;
}>;
