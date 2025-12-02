/// <reference types="./postgres-query-compiler.d.ts" />
import { DefaultQueryCompiler } from '../../query-compiler/default-query-compiler.js';
const ID_WRAP_REGEX = /"/g;
export class PostgresQueryCompiler extends DefaultQueryCompiler {
    sanitizeIdentifier(identifier) {
        return identifier.replace(ID_WRAP_REGEX, '""');
    }
}
