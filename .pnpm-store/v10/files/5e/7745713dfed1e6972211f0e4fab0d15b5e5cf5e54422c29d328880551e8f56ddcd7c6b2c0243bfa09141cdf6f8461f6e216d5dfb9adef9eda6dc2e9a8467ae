"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SqliteQueryCompiler = void 0;
const default_query_compiler_js_1 = require("../../query-compiler/default-query-compiler.js");
const ID_WRAP_REGEX = /"/g;
class SqliteQueryCompiler extends default_query_compiler_js_1.DefaultQueryCompiler {
    visitOrAction(node) {
        this.append('or ');
        this.append(node.action);
    }
    getCurrentParameterPlaceholder() {
        return '?';
    }
    getLeftExplainOptionsWrapper() {
        return '';
    }
    getRightExplainOptionsWrapper() {
        return '';
    }
    getLeftIdentifierWrapper() {
        return '"';
    }
    getRightIdentifierWrapper() {
        return '"';
    }
    getAutoIncrement() {
        return 'autoincrement';
    }
    sanitizeIdentifier(identifier) {
        return identifier.replace(ID_WRAP_REGEX, '""');
    }
    visitDefaultInsertValue(_) {
        // sqlite doesn't support the `default` keyword in inserts.
        this.append('null');
    }
}
exports.SqliteQueryCompiler = SqliteQueryCompiler;
