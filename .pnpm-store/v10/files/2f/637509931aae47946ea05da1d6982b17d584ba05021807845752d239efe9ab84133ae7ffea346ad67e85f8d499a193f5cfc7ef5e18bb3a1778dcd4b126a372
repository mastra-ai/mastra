import { GroupByItemNode } from '../operation-node/group-by-item-node.js';
import { ExpressionBuilder } from '../expression/expression-builder.js';
import { ReferenceExpression } from './reference-parser.js';
export type GroupByExpression<DB, TB extends keyof DB, O> = ReferenceExpression<DB, TB> | (keyof O & string);
export type GroupByArg<DB, TB extends keyof DB, O> = GroupByExpression<DB, TB, O> | ReadonlyArray<GroupByExpression<DB, TB, O>> | ((eb: ExpressionBuilder<DB, TB>) => ReadonlyArray<GroupByExpression<DB, TB, O>>);
export declare function parseGroupBy(groupBy: GroupByArg<any, any, any>): GroupByItemNode[];
