import { LargeBinary } from '../type.js';
import { VariableWidthBuilder, BuilderOptions } from '../builder.js';
/** @ignore */
export declare class LargeBinaryBuilder<TNull = any> extends VariableWidthBuilder<LargeBinary, TNull> {
    constructor(opts: BuilderOptions<LargeBinary, TNull>);
    get byteLength(): number;
    setValue(index: number, value: Uint8Array): void;
    protected _flushPending(pending: Map<number, Uint8Array | undefined>, pendingLength: number): void;
}
