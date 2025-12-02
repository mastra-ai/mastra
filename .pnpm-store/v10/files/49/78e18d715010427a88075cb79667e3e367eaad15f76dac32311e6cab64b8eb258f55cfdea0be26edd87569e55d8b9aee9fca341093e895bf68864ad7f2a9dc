import { DynamicReferenceBuilder } from '../dynamic/dynamic-reference-builder.js';
import { PartitionByItemNode } from '../operation-node/partition-by-item-node.js';
import { StringReference } from './reference-parser.js';
export type PartitionByExpression<DB, TB extends keyof DB> = StringReference<DB, TB> | DynamicReferenceBuilder<any>;
export type PartitionByExpressionOrList<DB, TB extends keyof DB> = ReadonlyArray<PartitionByExpression<DB, TB>> | PartitionByExpression<DB, TB>;
export declare function parsePartitionBy(partitionBy: PartitionByExpressionOrList<any, any>): PartitionByItemNode[];
