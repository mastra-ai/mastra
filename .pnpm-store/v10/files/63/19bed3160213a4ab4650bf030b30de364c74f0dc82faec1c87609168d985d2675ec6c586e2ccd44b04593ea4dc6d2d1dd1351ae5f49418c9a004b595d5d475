import { OperationNode } from './operation-node.js';
declare const SIMPLE_COLUMN_DATA_TYPES: readonly ["varchar", "char", "text", "integer", "int2", "int4", "int8", "smallint", "bigint", "boolean", "real", "double precision", "float4", "float8", "decimal", "numeric", "binary", "bytea", "date", "datetime", "time", "timetz", "timestamp", "timestamptz", "serial", "bigserial", "uuid", "json", "jsonb", "blob", "varbinary", "int4range", "int4multirange", "int8range", "int8multirange", "numrange", "nummultirange", "tsrange", "tsmultirange", "tstzrange", "tstzmultirange", "daterange", "datemultirange"];
type SimpleColumnDataType = (typeof SIMPLE_COLUMN_DATA_TYPES)[number];
export type ColumnDataType = SimpleColumnDataType | `varchar(${number})` | `char(${number})` | `decimal(${number}, ${number})` | `numeric(${number}, ${number})` | `binary(${number})` | `datetime(${number})` | `time(${number})` | `timetz(${number})` | `timestamp(${number})` | `timestamptz(${number})` | `varbinary(${number})`;
export type DataTypeParams = Omit<DataTypeNode, 'kind' | 'dataType'>;
export interface DataTypeNode extends OperationNode {
    readonly kind: 'DataTypeNode';
    readonly dataType: ColumnDataType;
}
/**
 * @internal
 */
export declare const DataTypeNode: Readonly<{
    is(node: OperationNode): node is DataTypeNode;
    create(dataType: ColumnDataType): DataTypeNode;
}>;
export declare function isColumnDataType(dataType: string): dataType is ColumnDataType;
export {};
