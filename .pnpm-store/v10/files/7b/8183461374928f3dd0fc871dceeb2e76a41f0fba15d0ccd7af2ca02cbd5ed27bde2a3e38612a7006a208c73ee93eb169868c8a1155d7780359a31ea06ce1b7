/// <reference types="./dynamic-table-builder.d.ts" />
import { AliasNode } from '../operation-node/alias-node.js';
import { IdentifierNode } from '../operation-node/identifier-node.js';
import { isOperationNodeSource, } from '../operation-node/operation-node-source.js';
import { parseTable } from '../parser/table-parser.js';
import { isObject, isString } from '../util/object-utils.js';
export class DynamicTableBuilder {
    #table;
    get table() {
        return this.#table;
    }
    constructor(table) {
        this.#table = table;
    }
    as(alias) {
        return new AliasedDynamicTableBuilder(this.#table, alias);
    }
}
export class AliasedDynamicTableBuilder {
    #table;
    #alias;
    get table() {
        return this.#table;
    }
    get alias() {
        return this.#alias;
    }
    constructor(table, alias) {
        this.#table = table;
        this.#alias = alias;
    }
    toOperationNode() {
        return AliasNode.create(parseTable(this.#table), IdentifierNode.create(this.#alias));
    }
}
export function isAliasedDynamicTableBuilder(obj) {
    return (isObject(obj) &&
        isOperationNodeSource(obj) &&
        isString(obj.table) &&
        isString(obj.alias));
}
