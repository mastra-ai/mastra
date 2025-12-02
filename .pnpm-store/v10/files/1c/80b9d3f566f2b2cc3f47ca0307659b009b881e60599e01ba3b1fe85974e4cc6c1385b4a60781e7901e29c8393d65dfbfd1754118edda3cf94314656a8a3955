import { Utf8 } from '../type.js';
import { VariableWidthBuilder, BuilderOptions } from '../builder.js';
/** @ignore */
export declare class Utf8Builder<TNull = any> extends VariableWidthBuilder<Utf8, TNull> {
    constructor(opts: BuilderOptions<Utf8, TNull>);
    get byteLength(): number;
    setValue(index: number, value: string): void;
    protected _flushPending(pending: Map<number, Uint8Array | undefined>, pendingLength: number): void;
}
