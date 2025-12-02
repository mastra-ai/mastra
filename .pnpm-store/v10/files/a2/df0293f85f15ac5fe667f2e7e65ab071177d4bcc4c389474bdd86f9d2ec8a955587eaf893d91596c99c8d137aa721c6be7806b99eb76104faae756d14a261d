import { Data } from '../data.js';
import { Vector } from '../vector.js';
import { Visitor } from '../visitor.js';
import { Type } from '../enum.js';
import { RecordBatch } from '../recordbatch.js';
import { TypeToDataType } from '../interfaces.js';
import { BufferRegion, FieldNode } from '../ipc/metadata/message.js';
import { DataType, Dictionary, Float, Int, Date_, Interval, Time, Timestamp, Union, Duration, Bool, Null, Utf8, LargeUtf8, Binary, LargeBinary, Decimal, FixedSizeBinary, List, FixedSizeList, Map_, Struct } from '../type.js';
/** @ignore */
export interface VectorAssembler extends Visitor {
    visit<T extends DataType>(node: Vector<T> | Data<T>): this;
    visitMany<T extends DataType>(nodes: readonly Data<T>[]): this[];
    getVisitFn<T extends Type>(node: T): (data: Data<TypeToDataType<T>>) => this;
    getVisitFn<T extends DataType>(node: Vector<T> | Data<T> | T): (data: Data<T>) => this;
    visitBool<T extends Bool>(data: Data<T>): this;
    visitInt<T extends Int>(data: Data<T>): this;
    visitFloat<T extends Float>(data: Data<T>): this;
    visitUtf8<T extends Utf8>(data: Data<T>): this;
    visitLargeUtf8<T extends LargeUtf8>(data: Data<T>): this;
    visitBinary<T extends Binary>(data: Data<T>): this;
    visitLargeBinary<T extends LargeBinary>(data: Data<T>): this;
    visitFixedSizeBinary<T extends FixedSizeBinary>(data: Data<T>): this;
    visitDate<T extends Date_>(data: Data<T>): this;
    visitTimestamp<T extends Timestamp>(data: Data<T>): this;
    visitTime<T extends Time>(data: Data<T>): this;
    visitDecimal<T extends Decimal>(data: Data<T>): this;
    visitList<T extends List>(data: Data<T>): this;
    visitStruct<T extends Struct>(data: Data<T>): this;
    visitUnion<T extends Union>(data: Data<T>): this;
    visitInterval<T extends Interval>(data: Data<T>): this;
    visitDuration<T extends Duration>(data: Data<T>): this;
    visitFixedSizeList<T extends FixedSizeList>(data: Data<T>): this;
    visitMap<T extends Map_>(data: Data<T>): this;
}
/** @ignore */
export declare class VectorAssembler extends Visitor {
    /** @nocollapse */
    static assemble<T extends Vector | RecordBatch>(...args: (T | T[])[]): VectorAssembler;
    private constructor();
    visitNull<T extends Null>(_null: Data<T>): this;
    visitDictionary<T extends Dictionary>(data: Data<T>): this;
    get nodes(): FieldNode[];
    get buffers(): ArrayBufferView[];
    get byteLength(): number;
    get bufferRegions(): BufferRegion[];
    protected _byteLength: number;
    protected _nodes: FieldNode[];
    protected _buffers: ArrayBufferView[];
    protected _bufferRegions: BufferRegion[];
}
