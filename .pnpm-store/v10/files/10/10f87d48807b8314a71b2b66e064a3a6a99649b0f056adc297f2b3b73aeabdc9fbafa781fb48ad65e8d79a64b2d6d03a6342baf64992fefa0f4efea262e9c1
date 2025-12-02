import { AssistantStreamChunk } from "./AssistantStreamChunk";
export type AssistantStream = ReadableStream<AssistantStreamChunk>;
export type AssistantStreamEncoder = ReadableWritablePair<Uint8Array<ArrayBuffer>, AssistantStreamChunk> & {
    headers?: Headers;
};
export declare const AssistantStream: {
    toResponse(stream: AssistantStream, transformer: AssistantStreamEncoder): Response;
    fromResponse(response: Response, transformer: ReadableWritablePair<AssistantStreamChunk, Uint8Array<ArrayBuffer>>): ReadableStream<AssistantStreamChunk>;
    toByteStream(stream: AssistantStream, transformer: ReadableWritablePair<Uint8Array<ArrayBuffer>, AssistantStreamChunk>): ReadableStream<Uint8Array<ArrayBuffer>>;
    fromByteStream(readable: ReadableStream<Uint8Array<ArrayBuffer>>, transformer: ReadableWritablePair<AssistantStreamChunk, Uint8Array<ArrayBuffer>>): ReadableStream<AssistantStreamChunk>;
};
//# sourceMappingURL=AssistantStream.d.ts.map