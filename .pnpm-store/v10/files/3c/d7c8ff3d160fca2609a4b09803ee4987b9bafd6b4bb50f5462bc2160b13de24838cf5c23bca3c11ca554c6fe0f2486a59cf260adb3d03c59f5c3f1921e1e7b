import { ColumnUpdateNode } from '../operation-node/column-update-node.js';
import { ExpressionBuilder } from '../expression/expression-builder.js';
import { UpdateType } from '../util/column-type.js';
import { ValueExpression } from './value-parser.js';
import { ExtractRawTypeFromReferenceExpression, ReferenceExpression } from './reference-parser.js';
import { AnyColumn, DrainOuterGeneric } from '../util/type-utils.js';
export type UpdateObject<DB, TB extends keyof DB, UT extends keyof DB = TB> = DrainOuterGeneric<{
    [C in AnyColumn<DB, UT>]?: {
        [T in UT]: C extends keyof DB[T] ? ValueExpression<DB, TB, UpdateType<DB[T][C]>> | undefined : never;
    }[UT];
}>;
export type UpdateObjectFactory<DB, TB extends keyof DB, UT extends keyof DB> = (eb: ExpressionBuilder<DB, TB>) => UpdateObject<DB, TB, UT>;
export type UpdateObjectExpression<DB, TB extends keyof DB, UT extends keyof DB = TB> = UpdateObject<DB, TB, UT> | UpdateObjectFactory<DB, TB, UT>;
export type ExtractUpdateTypeFromReferenceExpression<DB, TB extends keyof DB, RE, DV = unknown> = UpdateType<ExtractRawTypeFromReferenceExpression<DB, TB, RE, DV>>;
export declare function parseUpdate(...args: [UpdateObjectExpression<any, any, any>] | [ReferenceExpression<any, any>, ValueExpression<any, any, any>]): ReadonlyArray<ColumnUpdateNode>;
export declare function parseUpdateObjectExpression(update: UpdateObjectExpression<any, any, any>): ReadonlyArray<ColumnUpdateNode>;
