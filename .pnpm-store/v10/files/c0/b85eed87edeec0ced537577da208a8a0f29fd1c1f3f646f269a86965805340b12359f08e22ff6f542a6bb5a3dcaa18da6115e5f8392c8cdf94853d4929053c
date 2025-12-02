import { LargeUtf8 } from '../type.js';
import { VariableWidthBuilder, BuilderOptions } from '../builder.js';
/** @ignore */
export declare class LargeUtf8Builder<TNull = any> extends VariableWidthBuilder<LargeUtf8, TNull> {
    constructor(opts: BuilderOptions<LargeUtf8, TNull>);
    get byteLength(): number;
    setValue(index: number, value: string): void;
    protected _flushPending(pending: Map<number, Uint8Array | undefined>, pendingLength: number): void;
}
