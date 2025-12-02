"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataTypeNode = void 0;
exports.isColumnDataType = isColumnDataType;
const object_utils_js_1 = require("../util/object-utils.js");
const SIMPLE_COLUMN_DATA_TYPES = [
    'varchar',
    'char',
    'text',
    'integer',
    'int2',
    'int4',
    'int8',
    'smallint',
    'bigint',
    'boolean',
    'real',
    'double precision',
    'float4',
    'float8',
    'decimal',
    'numeric',
    'binary',
    'bytea',
    'date',
    'datetime',
    'time',
    'timetz',
    'timestamp',
    'timestamptz',
    'serial',
    'bigserial',
    'uuid',
    'json',
    'jsonb',
    'blob',
    'varbinary',
    'int4range',
    'int4multirange',
    'int8range',
    'int8multirange',
    'numrange',
    'nummultirange',
    'tsrange',
    'tsmultirange',
    'tstzrange',
    'tstzmultirange',
    'daterange',
    'datemultirange',
];
const COLUMN_DATA_TYPE_REGEX = [
    /^varchar\(\d+\)$/,
    /^char\(\d+\)$/,
    /^decimal\(\d+, \d+\)$/,
    /^numeric\(\d+, \d+\)$/,
    /^binary\(\d+\)$/,
    /^datetime\(\d+\)$/,
    /^time\(\d+\)$/,
    /^timetz\(\d+\)$/,
    /^timestamp\(\d+\)$/,
    /^timestamptz\(\d+\)$/,
    /^varbinary\(\d+\)$/,
];
/**
 * @internal
 */
exports.DataTypeNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'DataTypeNode';
    },
    create(dataType) {
        return (0, object_utils_js_1.freeze)({
            kind: 'DataTypeNode',
            dataType,
        });
    },
});
function isColumnDataType(dataType) {
    if (SIMPLE_COLUMN_DATA_TYPES.includes(dataType)) {
        return true;
    }
    if (COLUMN_DATA_TYPE_REGEX.some((r) => r.test(dataType))) {
        return true;
    }
    return false;
}
