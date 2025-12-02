import { DataType, List } from '../type.js';
import { OffsetsBufferBuilder } from './buffer.js';
import { Builder, BuilderOptions, VariableWidthBuilder } from '../builder.js';
/** @ignore */
export declare class ListBuilder<T extends DataType = any, TNull = any> extends VariableWidthBuilder<List<T>, TNull> {
    protected _offsets: OffsetsBufferBuilder<List<T>>;
    constructor(opts: BuilderOptions<List<T>, TNull>);
    addChild(child: Builder<T>, name?: string): number;
    protected _flushPending(pending: Map<number, T['TValue'] | undefined>): void;
}
