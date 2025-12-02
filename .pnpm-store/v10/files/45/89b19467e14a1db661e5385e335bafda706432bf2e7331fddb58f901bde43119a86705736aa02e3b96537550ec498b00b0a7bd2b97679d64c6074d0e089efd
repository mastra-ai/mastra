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

import { Vector } from '../vector.js';
import { IntBuilder } from './int.js';
import { Dictionary, DataType } from '../type.js';
import { Builder, BuilderOptions } from '../builder.js';
import { makeBuilder } from '../factories.js';

type DictionaryHashFunction = (x: any) => string | number;

export interface DictionaryBuilderOptions<T extends DataType = any, TNull = any> extends BuilderOptions<T, TNull> {
    dictionaryHashFunction?: DictionaryHashFunction;
}

/** @ignore */
export class DictionaryBuilder<T extends Dictionary, TNull = any> extends Builder<T, TNull> {

    protected _dictionaryOffset: number;
    protected _dictionary?: Vector<T['dictionary']>;
    protected _keysToIndices: { [key: string]: number };
    public readonly indices: IntBuilder<T['indices']>;
    public readonly dictionary: Builder<T['dictionary']>;

    constructor({ 'type': type, 'nullValues': nulls, 'dictionaryHashFunction': hashFn }: DictionaryBuilderOptions<T, TNull>) {
        super({ type: new Dictionary(type.dictionary, type.indices, type.id, type.isOrdered) as T });
        this._nulls = <any>null;
        this._dictionaryOffset = 0;
        this._keysToIndices = Object.create(null);
        this.indices = makeBuilder({ 'type': this.type.indices, 'nullValues': nulls }) as IntBuilder<T['indices']>;
        this.dictionary = makeBuilder({ 'type': this.type.dictionary, 'nullValues': null }) as Builder<T['dictionary']>;
        if (typeof hashFn === 'function') {
            this.valueToKey = hashFn;
        }
    }

    public get values() { return this.indices.values; }
    public get nullCount() { return this.indices.nullCount; }
    public get nullBitmap() { return this.indices.nullBitmap; }
    public get byteLength() { return this.indices.byteLength + this.dictionary.byteLength; }
    public get reservedLength() { return this.indices.reservedLength + this.dictionary.reservedLength; }
    public get reservedByteLength() { return this.indices.reservedByteLength + this.dictionary.reservedByteLength; }
    public isValid(value: T['TValue'] | TNull) { return this.indices.isValid(value); }
    public setValid(index: number, valid: boolean) {
        const indices = this.indices;
        valid = indices.setValid(index, valid);
        this.length = indices.length;
        return valid;
    }
    public setValue(index: number, value: T['TValue']) {
        const keysToIndices = this._keysToIndices;
        const key = this.valueToKey(value);
        let idx = keysToIndices[key];
        if (idx === undefined) {
            keysToIndices[key] = idx = this._dictionaryOffset + this.dictionary.append(value).length - 1;
        }
        return this.indices.setValue(index, idx);
    }
    public flush() {
        const type = this.type;
        const prev = this._dictionary;
        const curr = this.dictionary.toVector();
        const data = this.indices.flush().clone(type);
        data.dictionary = prev ? prev.concat(curr) : curr;
        this.finished || (this._dictionaryOffset += curr.length);
        this._dictionary = data.dictionary as Vector<T['dictionary']>;
        this.clear();
        return data;
    }
    public finish() {
        this.indices.finish();
        this.dictionary.finish();
        this._dictionaryOffset = 0;
        this._keysToIndices = Object.create(null);
        return super.finish();
    }
    public clear() {
        this.indices.clear();
        this.dictionary.clear();
        return super.clear();
    }
    public valueToKey(val: any): string | number {
        return typeof val === 'string' ? val : `${val}`;
    }
}
