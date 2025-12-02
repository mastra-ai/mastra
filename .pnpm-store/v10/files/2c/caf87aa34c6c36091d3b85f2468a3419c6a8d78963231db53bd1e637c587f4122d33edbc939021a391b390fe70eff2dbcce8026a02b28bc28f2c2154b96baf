import { DefaultInsertValueNode } from '../../operation-node/default-insert-value-node.js';
import { OrActionNode } from '../../operation-node/or-action-node.js';
import { DefaultQueryCompiler } from '../../query-compiler/default-query-compiler.js';
export declare class SqliteQueryCompiler extends DefaultQueryCompiler {
    protected visitOrAction(node: OrActionNode): void;
    protected getCurrentParameterPlaceholder(): string;
    protected getLeftExplainOptionsWrapper(): string;
    protected getRightExplainOptionsWrapper(): string;
    protected getLeftIdentifierWrapper(): string;
    protected getRightIdentifierWrapper(): string;
    protected getAutoIncrement(): string;
    protected sanitizeIdentifier(identifier: string): string;
    protected visitDefaultInsertValue(_: DefaultInsertValueNode): void;
}
