/// <reference types="./case-node.d.ts" />
import { freeze } from '../util/object-utils.js';
import { WhenNode } from './when-node.js';
/**
 * @internal
 */
export const CaseNode = freeze({
    is(node) {
        return node.kind === 'CaseNode';
    },
    create(value) {
        return freeze({
            kind: 'CaseNode',
            value,
        });
    },
    cloneWithWhen(caseNode, when) {
        return freeze({
            ...caseNode,
            when: freeze(caseNode.when ? [...caseNode.when, when] : [when]),
        });
    },
    cloneWithThen(caseNode, then) {
        return freeze({
            ...caseNode,
            when: caseNode.when
                ? freeze([
                    ...caseNode.when.slice(0, -1),
                    WhenNode.cloneWithResult(caseNode.when[caseNode.when.length - 1], then),
                ])
                : undefined,
        });
    },
    cloneWith(caseNode, props) {
        return freeze({
            ...caseNode,
            ...props,
        });
    },
});
