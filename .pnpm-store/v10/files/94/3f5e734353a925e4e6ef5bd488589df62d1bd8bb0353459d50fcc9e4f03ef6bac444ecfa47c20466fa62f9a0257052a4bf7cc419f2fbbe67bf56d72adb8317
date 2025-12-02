import { PipeableTransformStream } from "../utils/stream/PipeableTransformStream";
import { ObjectStreamChunk } from "./types";
export declare class ObjectStreamEncoder extends PipeableTransformStream<ObjectStreamChunk, Uint8Array> {
    constructor();
}
export declare class ObjectStreamDecoder extends PipeableTransformStream<Uint8Array<ArrayBuffer>, ObjectStreamChunk> {
    constructor();
}
export declare class ObjectStreamResponse extends Response {
    constructor(body: ReadableStream<ObjectStreamChunk>);
}
export declare const fromObjectStreamResponse: (response: Response) => ReadableStream<ObjectStreamChunk>;
//# sourceMappingURL=ObjectStreamResponse.d.ts.map