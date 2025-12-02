import { DynamicReferenceBuilder } from '../dynamic/dynamic-reference-builder.js';
import { Expression } from '../expression/expression.js';
import { OrderByItemNode } from '../operation-node/order-by-item-node.js';
import { OrderByItemBuilder } from '../query-builder/order-by-item-builder.js';
import { ExpressionOrFactory } from './expression-parser.js';
import { ReferenceExpression, StringReference } from './reference-parser.js';
export type OrderByExpression<DB, TB extends keyof DB, O> = StringReference<DB, TB> | (keyof O & string) | ExpressionOrFactory<DB, TB, any> | DynamicReferenceBuilder<any>;
export type OrderByModifiers = OrderByDirection | OrderByModifiersCallbackExpression;
export type OrderByDirection = 'asc' | 'desc';
export declare function isOrderByDirection(thing: unknown): thing is OrderByDirection;
export type OrderByModifiersCallbackExpression = (builder: OrderByItemBuilder) => OrderByItemBuilder;
/**
 * @deprecated performance reasons, use {@link OrderByExpression} instead.
 */
export type DirectedOrderByStringReference<DB, TB extends keyof DB, O> = `${StringReference<DB, TB> | (keyof O & string)} ${OrderByDirection}`;
/**
 * @deprecated replaced with {@link OrderByModifiers}
 */
export type OrderByDirectionExpression = OrderByDirection | Expression<any>;
/**
 * @deprecated use {@link OrderByExpression} instead.
 */
export type UndirectedOrderByExpression<DB, TB extends keyof DB, O> = ReferenceExpression<DB, TB> | (keyof O & string);
export declare function parseOrderBy(args: any[]): OrderByItemNode[];
export declare function parseOrderByItem(expr: OrderByExpression<any, any, any>, modifiers?: OrderByModifiers): OrderByItemNode;
