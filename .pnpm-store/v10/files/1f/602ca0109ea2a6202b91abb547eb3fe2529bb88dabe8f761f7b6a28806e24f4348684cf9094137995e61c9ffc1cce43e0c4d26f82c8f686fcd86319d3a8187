import { AliasedSelectQueryBuilder } from '../query-builder/select-query-builder.js';
import { SelectionNode } from '../operation-node/selection-node.js';
import { AnyAliasedColumn, AnyAliasedColumnWithTable, AnyColumn, AnyColumnWithTable, DrainOuterGeneric, ExtractColumnType } from '../util/type-utils.js';
import { DynamicReferenceBuilder } from '../dynamic/dynamic-reference-builder.js';
import { AliasedExpressionOrFactory } from './expression-parser.js';
import { SelectType } from '../util/column-type.js';
import { AliasedExpression } from '../expression/expression.js';
import { ExpressionBuilder } from '../expression/expression-builder.js';
export type SelectExpression<DB, TB extends keyof DB> = AnyAliasedColumnWithTable<DB, TB> | AnyAliasedColumn<DB, TB> | AnyColumnWithTable<DB, TB> | AnyColumn<DB, TB> | DynamicReferenceBuilder<any> | AliasedExpressionOrFactory<DB, TB>;
export type SelectCallback<DB, TB extends keyof DB> = (eb: ExpressionBuilder<DB, TB>) => ReadonlyArray<SelectExpression<DB, TB>>;
/**
 * Turns a SelectExpression or a union of them into a selection object.
 */
export type Selection<DB, TB extends keyof DB, SE> = [DB] extends [unknown] ? {
    [E in FlattenSelectExpression<SE> as ExtractAliasFromSelectExpression<E>]: SelectType<ExtractTypeFromSelectExpression<DB, TB, E>>;
} : {};
/**
 * Turns a SelectCallback into a selection object.
 */
export type CallbackSelection<DB, TB extends keyof DB, CB> = CB extends (eb: any) => ReadonlyArray<infer SE> ? Selection<DB, TB, SE> : never;
export type SelectArg<DB, TB extends keyof DB, SE extends SelectExpression<DB, TB>> = SE | ReadonlyArray<SE> | ((eb: ExpressionBuilder<DB, TB>) => ReadonlyArray<SE>);
type FlattenSelectExpression<SE> = SE extends DynamicReferenceBuilder<infer RA> ? {
    [R in RA]: DynamicReferenceBuilder<R>;
}[RA] : SE;
type ExtractAliasFromSelectExpression<SE> = SE extends string ? ExtractAliasFromStringSelectExpression<SE> : SE extends AliasedExpression<any, infer EA> ? EA : SE extends (qb: any) => AliasedExpression<any, infer EA> ? EA : SE extends DynamicReferenceBuilder<infer RA> ? ExtractAliasFromStringSelectExpression<RA> : never;
type ExtractAliasFromStringSelectExpression<SE extends string> = SE extends `${string}.${string}.${string} as ${infer A}` ? A : SE extends `${string}.${string} as ${infer A}` ? A : SE extends `${string} as ${infer A}` ? A : SE extends `${string}.${string}.${infer C}` ? C : SE extends `${string}.${infer C}` ? C : SE;
type ExtractTypeFromSelectExpression<DB, TB extends keyof DB, SE> = SE extends string ? ExtractTypeFromStringSelectExpression<DB, TB, SE> : SE extends AliasedSelectQueryBuilder<infer O, any> ? O[keyof O] | null : SE extends (eb: any) => AliasedSelectQueryBuilder<infer O, any> ? O[keyof O] | null : SE extends AliasedExpression<infer O, any> ? O : SE extends (eb: any) => AliasedExpression<infer O, any> ? O : SE extends DynamicReferenceBuilder<infer RA> ? ExtractTypeFromStringSelectExpression<DB, TB, RA> | undefined : never;
type ExtractTypeFromStringSelectExpression<DB, TB extends keyof DB, SE extends string> = SE extends `${infer SC}.${infer T}.${infer C} as ${string}` ? `${SC}.${T}` extends TB ? C extends keyof DB[`${SC}.${T}`] ? DB[`${SC}.${T}`][C] : never : never : SE extends `${infer T}.${infer C} as ${string}` ? T extends TB ? C extends keyof DB[T] ? DB[T][C] : never : never : SE extends `${infer C} as ${string}` ? C extends AnyColumn<DB, TB> ? ExtractColumnType<DB, TB, C> : never : SE extends `${infer SC}.${infer T}.${infer C}` ? `${SC}.${T}` extends TB ? C extends keyof DB[`${SC}.${T}`] ? DB[`${SC}.${T}`][C] : never : never : SE extends `${infer T}.${infer C}` ? T extends TB ? C extends keyof DB[T] ? DB[T][C] : never : never : SE extends AnyColumn<DB, TB> ? ExtractColumnType<DB, TB, SE> : never;
export type AllSelection<DB, TB extends keyof DB> = DrainOuterGeneric<{
    [C in AnyColumn<DB, TB>]: {
        [T in TB]: SelectType<C extends keyof DB[T] ? DB[T][C] : never>;
    }[TB];
}>;
export declare function parseSelectArg(selection: SelectArg<any, any, SelectExpression<any, any>>): SelectionNode[];
export declare function parseSelectAll(table?: string | string[]): SelectionNode[];
export {};
