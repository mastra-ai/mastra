import { CreateIndexNode } from '../../operation-node/create-index-node.js';
import { DefaultQueryCompiler } from '../../query-compiler/default-query-compiler.js';
export declare class MysqlQueryCompiler extends DefaultQueryCompiler {
    protected getCurrentParameterPlaceholder(): string;
    protected getLeftExplainOptionsWrapper(): string;
    protected getExplainOptionAssignment(): string;
    protected getExplainOptionsDelimiter(): string;
    protected getRightExplainOptionsWrapper(): string;
    protected getLeftIdentifierWrapper(): string;
    protected getRightIdentifierWrapper(): string;
    protected sanitizeIdentifier(identifier: string): string;
    protected visitCreateIndex(node: CreateIndexNode): void;
}
