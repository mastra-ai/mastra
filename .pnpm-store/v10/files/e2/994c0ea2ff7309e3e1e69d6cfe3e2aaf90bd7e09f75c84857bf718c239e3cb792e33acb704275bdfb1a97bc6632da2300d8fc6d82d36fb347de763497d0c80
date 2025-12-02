import { Binary } from '../type.js';
import { VariableWidthBuilder, BuilderOptions } from '../builder.js';
/** @ignore */
export declare class BinaryBuilder<TNull = any> extends VariableWidthBuilder<Binary, TNull> {
    constructor(opts: BuilderOptions<Binary, TNull>);
    get byteLength(): number;
    setValue(index: number, value: Uint8Array): void;
    protected _flushPending(pending: Map<number, Uint8Array | undefined>, pendingLength: number): void;
}
