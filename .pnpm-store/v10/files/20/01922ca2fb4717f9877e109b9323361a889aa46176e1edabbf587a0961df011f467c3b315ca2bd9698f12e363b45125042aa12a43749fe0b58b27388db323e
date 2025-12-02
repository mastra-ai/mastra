"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgresQueryCompiler = void 0;
const default_query_compiler_js_1 = require("../../query-compiler/default-query-compiler.js");
const ID_WRAP_REGEX = /"/g;
class PostgresQueryCompiler extends default_query_compiler_js_1.DefaultQueryCompiler {
    sanitizeIdentifier(identifier) {
        return identifier.replace(ID_WRAP_REGEX, '""');
    }
}
exports.PostgresQueryCompiler = PostgresQueryCompiler;
