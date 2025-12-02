// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

/* eslint-disable brace-style */

import { Schema, Field } from '../../schema.js';
import {
    DataType, Dictionary, TimeBitWidth,
    Utf8, LargeUtf8, Binary, LargeBinary, Decimal, FixedSizeBinary,
    List, FixedSizeList, Map_, Struct, Union,
    Bool, Null, Int, Float, Date_, Time, Interval, Timestamp, IntBitWidth, Int32, TKeys, Duration,
} from '../../type.js';

import { DictionaryBatch, RecordBatch, FieldNode, BufferRegion } from './message.js';
import { TimeUnit, Precision, IntervalUnit, UnionMode, DateUnit } from '../../enum.js';

/** @ignore */
export function schemaFromJSON(_schema: any, dictionaries: Map<number, DataType> = new Map()) {
    return new Schema(
        schemaFieldsFromJSON(_schema, dictionaries),
        customMetadataFromJSON(_schema['metadata']),
        dictionaries
    );
}

/** @ignore */
export function recordBatchFromJSON(b: any) {
    return new RecordBatch(
        b['count'],
        fieldNodesFromJSON(b['columns']),
        buffersFromJSON(b['columns'])
    );
}

/** @ignore */
export function dictionaryBatchFromJSON(b: any) {
    return new DictionaryBatch(
        recordBatchFromJSON(b['data']),
        b['id'], b['isDelta']
    );
}

/** @ignore */
function schemaFieldsFromJSON(_schema: any, dictionaries?: Map<number, DataType>) {
    return (_schema['fields'] || []).filter(Boolean).map((f: any) => Field.fromJSON(f, dictionaries));
}

/** @ignore */
function fieldChildrenFromJSON(_field: any, dictionaries?: Map<number, DataType>): Field[] {
    return (_field['children'] || []).filter(Boolean).map((f: any) => Field.fromJSON(f, dictionaries));
}

/** @ignore */
function fieldNodesFromJSON(xs: any[]): FieldNode[] {
    return (xs || []).reduce<FieldNode[]>((fieldNodes, column: any) => [
        ...fieldNodes,
        new FieldNode(
            column['count'],
            nullCountFromJSON(column['VALIDITY'])
        ),
        ...fieldNodesFromJSON(column['children'])
    ], [] as FieldNode[]);
}

/** @ignore */
function buffersFromJSON(xs: any[], buffers: BufferRegion[] = []): BufferRegion[] {
    for (let i = -1, n = (xs || []).length; ++i < n;) {
        const column = xs[i];
        column['VALIDITY'] && buffers.push(new BufferRegion(buffers.length, column['VALIDITY'].length));
        column['TYPE_ID'] && buffers.push(new BufferRegion(buffers.length, column['TYPE_ID'].length));
        column['OFFSET'] && buffers.push(new BufferRegion(buffers.length, column['OFFSET'].length));
        column['DATA'] && buffers.push(new BufferRegion(buffers.length, column['DATA'].length));
        buffers = buffersFromJSON(column['children'], buffers);
    }
    return buffers;
}

/** @ignore */
function nullCountFromJSON(validity: number[]) {
    return (validity || []).reduce((sum, val) => sum + +(val === 0), 0);
}

/** @ignore */
export function fieldFromJSON(_field: any, dictionaries?: Map<number, DataType>) {

    let id: number;
    let keys: TKeys | null;
    let field: Field | void;
    let dictMeta: any;
    let type: DataType<any>;
    let dictType: Dictionary;

    // If no dictionary encoding
    if (!dictionaries || !(dictMeta = _field['dictionary'])) {
        type = typeFromJSON(_field, fieldChildrenFromJSON(_field, dictionaries));
        field = new Field(_field['name'], type, _field['nullable'], customMetadataFromJSON(_field['metadata']));
    }
    // If dictionary encoded and the first time we've seen this dictionary id, decode
    // the data type and child fields, then wrap in a Dictionary type and insert the
    // data type into the dictionary types map.
    else if (!dictionaries.has(id = dictMeta['id'])) {
        // a dictionary index defaults to signed 32 bit int if unspecified
        keys = (keys = dictMeta['indexType']) ? indexTypeFromJSON(keys) as TKeys : new Int32();
        dictionaries.set(id, type = typeFromJSON(_field, fieldChildrenFromJSON(_field, dictionaries)));
        dictType = new Dictionary(type, keys, id, dictMeta['isOrdered']);
        field = new Field(_field['name'], dictType, _field['nullable'], customMetadataFromJSON(_field['metadata']));
    }
    // If dictionary encoded, and have already seen this dictionary Id in the schema, then reuse the
    // data type and wrap in a new Dictionary type and field.
    else {
        // a dictionary index defaults to signed 32 bit int if unspecified
        keys = (keys = dictMeta['indexType']) ? indexTypeFromJSON(keys) as TKeys : new Int32();
        dictType = new Dictionary(dictionaries.get(id)!, keys, id, dictMeta['isOrdered']);
        field = new Field(_field['name'], dictType, _field['nullable'], customMetadataFromJSON(_field['metadata']));
    }
    return field || null;
}

/** @ignore */
function customMetadataFromJSON(metadata: { key: string; value: string }[] = []) {
    return new Map<string, string>(metadata.map(({ key, value }) => [key, value]));
}

/** @ignore */
function indexTypeFromJSON(_type: any) {
    return new Int(_type['isSigned'], _type['bitWidth']);
}

/** @ignore */
function typeFromJSON(f: any, children?: Field[]): DataType<any> {

    const typeId = f['type']['name'];

    switch (typeId) {
        case 'NONE': return new Null();
        case 'null': return new Null();
        case 'binary': return new Binary();
        case 'largebinary': return new LargeBinary();
        case 'utf8': return new Utf8();
        case 'largeutf8': return new LargeUtf8();
        case 'bool': return new Bool();
        case 'list': return new List((children || [])[0]);
        case 'struct': return new Struct(children || []);
        case 'struct_': return new Struct(children || []);
    }

    switch (typeId) {
        case 'int': {
            const t = f['type'];
            return new Int(t['isSigned'], t['bitWidth'] as IntBitWidth);
        }
        case 'floatingpoint': {
            const t = f['type'];
            return new Float(Precision[t['precision']] as any);
        }
        case 'decimal': {
            const t = f['type'];
            return new Decimal(t['scale'], t['precision'], t['bitWidth']);
        }
        case 'date': {
            const t = f['type'];
            return new Date_(DateUnit[t['unit']] as any);
        }
        case 'time': {
            const t = f['type'];
            return new Time(TimeUnit[t['unit']] as any, t['bitWidth'] as TimeBitWidth);
        }
        case 'timestamp': {
            const t = f['type'];
            return new Timestamp(TimeUnit[t['unit']] as any, t['timezone']);
        }
        case 'interval': {
            const t = f['type'];
            return new Interval(IntervalUnit[t['unit']] as any);
        }
        case 'duration': {
            const t = f['type'];
            return new Duration(TimeUnit[t['unit']] as any);
        }
        case 'union': {
            const t = f['type'];
            const [m, ...ms] = (t['mode'] + '').toLowerCase();
            const mode = (m.toUpperCase() + ms.join('')) as keyof typeof UnionMode;
            return new Union(UnionMode[mode] as any, (t['typeIds'] || []), children || []);
        }
        case 'fixedsizebinary': {
            const t = f['type'];
            return new FixedSizeBinary(t['byteWidth']);
        }
        case 'fixedsizelist': {
            const t = f['type'];
            return new FixedSizeList(t['listSize'], (children || [])[0]);
        }
        case 'map': {
            const t = f['type'];
            return new Map_((children || [])[0], t['keysSorted']);
        }
    }
    throw new Error(`Unrecognized type: "${typeId}"`);
}
