/// <reference types="./mysql-query-compiler.d.ts" />
import { DefaultQueryCompiler } from '../../query-compiler/default-query-compiler.js';
const ID_WRAP_REGEX = /`/g;
export class MysqlQueryCompiler extends DefaultQueryCompiler {
    getCurrentParameterPlaceholder() {
        return '?';
    }
    getLeftExplainOptionsWrapper() {
        return '';
    }
    getExplainOptionAssignment() {
        return '=';
    }
    getExplainOptionsDelimiter() {
        return ' ';
    }
    getRightExplainOptionsWrapper() {
        return '';
    }
    getLeftIdentifierWrapper() {
        return '`';
    }
    getRightIdentifierWrapper() {
        return '`';
    }
    sanitizeIdentifier(identifier) {
        return identifier.replace(ID_WRAP_REGEX, '``');
    }
    visitCreateIndex(node) {
        this.append('create ');
        if (node.unique) {
            this.append('unique ');
        }
        this.append('index ');
        if (node.ifNotExists) {
            this.append('if not exists ');
        }
        this.visitNode(node.name);
        if (node.using) {
            this.append(' using ');
            this.visitNode(node.using);
        }
        if (node.table) {
            this.append(' on ');
            this.visitNode(node.table);
        }
        if (node.columns) {
            this.append(' (');
            this.compileList(node.columns);
            this.append(')');
        }
        if (node.where) {
            this.append(' ');
            this.visitNode(node.where);
        }
    }
}
