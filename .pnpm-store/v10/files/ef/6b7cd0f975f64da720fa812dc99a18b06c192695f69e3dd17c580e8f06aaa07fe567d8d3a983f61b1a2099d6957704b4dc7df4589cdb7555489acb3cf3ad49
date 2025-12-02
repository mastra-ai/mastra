/// <reference types="node" />
import { AbortSignal } from "./abort";
import { BodyTypes, IBody, StorageBodyTypes } from "./core";
export declare class Body implements IBody {
    readonly bodyUsed: boolean;
    protected _length: number | null;
    protected _mime?: string;
    protected _body?: StorageBodyTypes | null;
    private _used;
    private _integrity?;
    private _signal?;
    constructor();
    arrayBuffer(allowIncomplete?: boolean): Promise<ArrayBuffer>;
    formData(): Promise<never>;
    json(): Promise<any>;
    text(allowIncomplete?: boolean): Promise<string>;
    readable(): Promise<NodeJS.ReadableStream>;
    protected setSignal(signal: AbortSignal | undefined): void;
    protected hasBody(): boolean;
    protected setBody(body: BodyTypes | IBody | null, mime?: string | null, integrity?: string | null, length?: number | null): void;
    private awaitBuffer;
    private validateIntegrity;
    private _ensureNotAborted;
    private _ensureUnused;
    private blob;
}
export declare class JsonBody extends Body {
    constructor(obj: any);
}
export declare class StreamBody extends Body {
    constructor(readable: NodeJS.ReadableStream);
}
export declare class DataBody extends Body {
    constructor(data: Buffer | string | null);
}
export declare class BodyInspector extends Body {
    private _ref;
    constructor(body: Body);
    private _getMime;
    private _getLength;
    private _getBody;
    get mime(): string | undefined;
    get length(): number | null;
    get stream(): NodeJS.ReadableStream | undefined;
}
