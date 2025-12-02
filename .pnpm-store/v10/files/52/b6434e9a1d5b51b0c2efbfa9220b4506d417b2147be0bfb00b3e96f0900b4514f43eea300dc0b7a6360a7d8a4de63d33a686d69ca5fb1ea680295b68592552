/// <reference types="./deduplicate-joins-transformer.d.ts" />
import { OperationNodeTransformer } from '../../operation-node/operation-node-transformer.js';
import { compare, freeze } from '../../util/object-utils.js';
export class DeduplicateJoinsTransformer extends OperationNodeTransformer {
    transformSelectQuery(node, queryId) {
        return this.#transformQuery(super.transformSelectQuery(node, queryId));
    }
    transformUpdateQuery(node, queryId) {
        return this.#transformQuery(super.transformUpdateQuery(node, queryId));
    }
    transformDeleteQuery(node, queryId) {
        return this.#transformQuery(super.transformDeleteQuery(node, queryId));
    }
    #transformQuery(node) {
        if (!node.joins || node.joins.length === 0) {
            return node;
        }
        return freeze({
            ...node,
            joins: this.#deduplicateJoins(node.joins),
        });
    }
    #deduplicateJoins(joins) {
        const out = [];
        for (let i = 0; i < joins.length; ++i) {
            let foundDuplicate = false;
            for (let j = 0; j < out.length; ++j) {
                if (compare(joins[i], out[j])) {
                    foundDuplicate = true;
                    break;
                }
            }
            if (!foundDuplicate) {
                out.push(joins[i]);
            }
        }
        return freeze(out);
    }
}
