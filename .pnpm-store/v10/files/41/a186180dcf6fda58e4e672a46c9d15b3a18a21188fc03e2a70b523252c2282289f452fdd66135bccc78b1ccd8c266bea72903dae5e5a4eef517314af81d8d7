"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WithSchemaTransformer = void 0;
const alias_node_js_1 = require("../../operation-node/alias-node.js");
const identifier_node_js_1 = require("../../operation-node/identifier-node.js");
const join_node_js_1 = require("../../operation-node/join-node.js");
const list_node_js_1 = require("../../operation-node/list-node.js");
const operation_node_transformer_js_1 = require("../../operation-node/operation-node-transformer.js");
const schemable_identifier_node_js_1 = require("../../operation-node/schemable-identifier-node.js");
const table_node_js_1 = require("../../operation-node/table-node.js");
const object_utils_js_1 = require("../../util/object-utils.js");
// This object exist only so that we get a type error when a new RootOperationNode
// is added. If you get a type error here, make sure to add the new root node and
// handle it correctly in the transformer.
//
// DO NOT REFACTOR THIS EVEN IF IT SEEMS USELESS TO YOU!
const ROOT_OPERATION_NODES = (0, object_utils_js_1.freeze)({
    AlterTableNode: true,
    CreateIndexNode: true,
    CreateSchemaNode: true,
    CreateTableNode: true,
    CreateTypeNode: true,
    CreateViewNode: true,
    RefreshMaterializedViewNode: true,
    DeleteQueryNode: true,
    DropIndexNode: true,
    DropSchemaNode: true,
    DropTableNode: true,
    DropTypeNode: true,
    DropViewNode: true,
    InsertQueryNode: true,
    RawNode: true,
    SelectQueryNode: true,
    UpdateQueryNode: true,
    MergeQueryNode: true,
});
const SCHEMALESS_FUNCTIONS = {
    json_agg: true,
    to_json: true,
};
class WithSchemaTransformer extends operation_node_transformer_js_1.OperationNodeTransformer {
    #schema;
    #schemableIds = new Set();
    #ctes = new Set();
    constructor(schema) {
        super();
        this.#schema = schema;
    }
    transformNodeImpl(node, queryId) {
        if (!this.#isRootOperationNode(node)) {
            return super.transformNodeImpl(node, queryId);
        }
        const ctes = this.#collectCTEs(node);
        for (const cte of ctes) {
            this.#ctes.add(cte);
        }
        const tables = this.#collectSchemableIds(node);
        for (const table of tables) {
            this.#schemableIds.add(table);
        }
        const transformed = super.transformNodeImpl(node, queryId);
        for (const table of tables) {
            this.#schemableIds.delete(table);
        }
        for (const cte of ctes) {
            this.#ctes.delete(cte);
        }
        return transformed;
    }
    transformSchemableIdentifier(node, queryId) {
        const transformed = super.transformSchemableIdentifier(node, queryId);
        if (transformed.schema || !this.#schemableIds.has(node.identifier.name)) {
            return transformed;
        }
        return {
            ...transformed,
            schema: identifier_node_js_1.IdentifierNode.create(this.#schema),
        };
    }
    transformReferences(node, queryId) {
        const transformed = super.transformReferences(node, queryId);
        if (transformed.table.table.schema) {
            return transformed;
        }
        return {
            ...transformed,
            table: table_node_js_1.TableNode.createWithSchema(this.#schema, transformed.table.table.identifier.name),
        };
    }
    transformAggregateFunction(node, queryId) {
        return {
            ...super.transformAggregateFunction({ ...node, aggregated: [] }, queryId),
            aggregated: this.#transformTableArgsWithoutSchemas(node, queryId, 'aggregated'),
        };
    }
    transformFunction(node, queryId) {
        return {
            ...super.transformFunction({ ...node, arguments: [] }, queryId),
            arguments: this.#transformTableArgsWithoutSchemas(node, queryId, 'arguments'),
        };
    }
    #transformTableArgsWithoutSchemas(node, queryId, argsKey) {
        return SCHEMALESS_FUNCTIONS[node.func]
            ? node[argsKey].map((arg) => !table_node_js_1.TableNode.is(arg) || arg.table.schema
                ? this.transformNode(arg, queryId)
                : {
                    ...arg,
                    table: this.transformIdentifier(arg.table.identifier, queryId),
                })
            : this.transformNodeList(node[argsKey], queryId);
    }
    #isRootOperationNode(node) {
        return node.kind in ROOT_OPERATION_NODES;
    }
    #collectSchemableIds(node) {
        const schemableIds = new Set();
        if ('name' in node && node.name && schemable_identifier_node_js_1.SchemableIdentifierNode.is(node.name)) {
            this.#collectSchemableId(node.name, schemableIds);
        }
        if ('from' in node && node.from) {
            for (const from of node.from.froms) {
                this.#collectSchemableIdsFromTableExpr(from, schemableIds);
            }
        }
        if ('into' in node && node.into) {
            this.#collectSchemableIdsFromTableExpr(node.into, schemableIds);
        }
        if ('table' in node && node.table) {
            this.#collectSchemableIdsFromTableExpr(node.table, schemableIds);
        }
        if ('joins' in node && node.joins) {
            for (const join of node.joins) {
                this.#collectSchemableIdsFromTableExpr(join.table, schemableIds);
            }
        }
        if ('using' in node && node.using) {
            if (join_node_js_1.JoinNode.is(node.using)) {
                this.#collectSchemableIdsFromTableExpr(node.using.table, schemableIds);
            }
            else {
                this.#collectSchemableIdsFromTableExpr(node.using, schemableIds);
            }
        }
        return schemableIds;
    }
    #collectCTEs(node) {
        const ctes = new Set();
        if ('with' in node && node.with) {
            this.#collectCTEIds(node.with, ctes);
        }
        return ctes;
    }
    #collectSchemableIdsFromTableExpr(node, schemableIds) {
        if (table_node_js_1.TableNode.is(node)) {
            this.#collectSchemableId(node.table, schemableIds);
        }
        else if (alias_node_js_1.AliasNode.is(node) && table_node_js_1.TableNode.is(node.node)) {
            this.#collectSchemableId(node.node.table, schemableIds);
        }
        else if (list_node_js_1.ListNode.is(node)) {
            for (const table of node.items) {
                this.#collectSchemableIdsFromTableExpr(table, schemableIds);
            }
        }
    }
    #collectSchemableId(node, schemableIds) {
        const id = node.identifier.name;
        if (!this.#schemableIds.has(id) && !this.#ctes.has(id)) {
            schemableIds.add(id);
        }
    }
    #collectCTEIds(node, ctes) {
        for (const expr of node.expressions) {
            const cteId = expr.name.table.table.identifier.name;
            if (!this.#ctes.has(cteId)) {
                ctes.add(cteId);
            }
        }
    }
}
exports.WithSchemaTransformer = WithSchemaTransformer;
