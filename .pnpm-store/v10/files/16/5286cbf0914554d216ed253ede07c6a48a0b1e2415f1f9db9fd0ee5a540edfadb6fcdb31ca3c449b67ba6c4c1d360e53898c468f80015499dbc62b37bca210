import { ColumnNode } from '../operation-node/column-node.js';
import { ValueExpression } from './value-parser.js';
import { ValuesNode } from '../operation-node/values-node.js';
import { NonNullableInsertKeys, NullableInsertKeys, InsertType } from '../util/column-type.js';
import { ExpressionBuilder } from '../expression/expression-builder.js';
export type InsertObject<DB, TB extends keyof DB> = {
    [C in NonNullableInsertKeys<DB[TB]>]: ValueExpression<DB, TB, InsertType<DB[TB][C]>>;
} & {
    [C in NullableInsertKeys<DB[TB]>]?: ValueExpression<DB, TB, InsertType<DB[TB][C]>> | undefined;
};
export type InsertObjectOrList<DB, TB extends keyof DB> = InsertObject<DB, TB> | ReadonlyArray<InsertObject<DB, TB>>;
export type InsertObjectOrListFactory<DB, TB extends keyof DB, UT extends keyof DB = never> = (eb: ExpressionBuilder<DB, TB | UT>) => InsertObjectOrList<DB, TB>;
export type InsertExpression<DB, TB extends keyof DB, UT extends keyof DB = never> = InsertObjectOrList<DB, TB> | InsertObjectOrListFactory<DB, TB, UT>;
export declare function parseInsertExpression(arg: InsertExpression<any, any, any>): [ReadonlyArray<ColumnNode>, ValuesNode];
