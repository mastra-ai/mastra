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

import { Field } from '../schema.js';
import { DataBufferBuilder } from './buffer.js';
import { Builder, BuilderOptions } from '../builder.js';
import { Union, SparseUnion, DenseUnion } from '../type.js';

export interface UnionBuilderOptions<T extends Union = any, TNull = any> extends BuilderOptions<T, TNull> {
    valueToChildTypeId?: (builder: UnionBuilder<T, TNull>, value: any, offset: number) => number;
}

/** @ignore */
export abstract class UnionBuilder<T extends Union, TNull = any> extends Builder<T, TNull> {

    protected _typeIds: DataBufferBuilder<Int8Array>;

    constructor(options: UnionBuilderOptions<T, TNull>) {
        super(options);
        this._typeIds = new DataBufferBuilder(Int8Array, 0, 1);
        if (typeof options['valueToChildTypeId'] === 'function') {
            this._valueToChildTypeId = options['valueToChildTypeId'];
        }
    }

    public get typeIdToChildIndex() { return this.type.typeIdToChildIndex; }

    public append(value: T['TValue'] | TNull, childTypeId?: number) {
        return this.set(this.length, value, childTypeId);
    }

    public set(index: number, value: T['TValue'] | TNull, childTypeId?: number) {
        if (childTypeId === undefined) {
            childTypeId = this._valueToChildTypeId(this, value, index);
        }
        this.setValue(index, value, childTypeId);
        return this;
    }

    public setValue(index: number, value: T['TValue'], childTypeId?: number) {
        this._typeIds.set(index, childTypeId!);
        const childIndex = this.type.typeIdToChildIndex[childTypeId!];
        const child = this.children[childIndex];
        child?.set(index, value);
    }

    public addChild(child: Builder, name = `${this.children.length}`) {
        const childTypeId = this.children.push(child);
        const { type: { children, mode, typeIds } } = this;
        const fields = [...children, new Field(name, child.type)];
        this.type = <T>new Union(mode, [...typeIds, childTypeId], fields);
        return childTypeId;
    }

    /** @ignore */
    // @ts-ignore
    protected _valueToChildTypeId(builder: UnionBuilder<T, TNull>, value: any, offset: number): number {
        throw new Error(`Cannot map UnionBuilder value to child typeId. \
Pass the \`childTypeId\` as the second argument to unionBuilder.append(), \
or supply a \`valueToChildTypeId\` function as part of the UnionBuilder constructor options.`);
    }
}

/** @ignore */
export class SparseUnionBuilder<T extends SparseUnion, TNull = any> extends UnionBuilder<T, TNull> { }
/** @ignore */
export class DenseUnionBuilder<T extends DenseUnion, TNull = any> extends UnionBuilder<T, TNull> {

    protected _offsets: DataBufferBuilder<Int32Array>;

    constructor(options: UnionBuilderOptions<T, TNull>) {
        super(options);
        this._offsets = new DataBufferBuilder(Int32Array);
    }

    /** @ignore */
    public setValue(index: number, value: T['TValue'], childTypeId?: number) {
        const id = this._typeIds.set(index, childTypeId!).buffer[index];
        const child = this.getChildAt(this.type.typeIdToChildIndex[id])!;
        const denseIndex = this._offsets.set(index, child.length).buffer[index];
        child?.set(denseIndex, value);
    }
}
