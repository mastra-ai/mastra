import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { BlobStringReply, NumberReply, SimpleStringReply, TypeMapping, ReplyUnion } from "@redis/client/dist/lib/RESP/types";
import { InfoRawReplyTypes, InfoReply } from "./INFO";
type chunkType = Array<[
    'startTimestamp',
    NumberReply,
    'endTimestamp',
    NumberReply,
    'samples',
    NumberReply,
    'size',
    NumberReply,
    'bytesPerSample',
    SimpleStringReply
]>;
export type InfoDebugRawReplyType = InfoRawReplyTypes | chunkType;
export interface InfoDebugReply extends InfoReply {
    keySelfName: BlobStringReply;
    chunks: Array<{
        startTimestamp: NumberReply;
        endTimestamp: NumberReply;
        samples: NumberReply;
        size: NumberReply;
        bytesPerSample: SimpleStringReply;
    }>;
}
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Gets debug information about a time series
     * @param parser - The command parser
     * @param key - The key name of the time series
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: string) => void;
    readonly transformReply: {
        readonly 2: (this: void, reply: [...InfoRawReplyTypes[], "keySelfName", BlobStringReply<string>, "Chunks", chunkType], _: any, typeMapping?: TypeMapping) => InfoDebugReply;
        readonly 3: () => ReplyUnion;
    };
    readonly unstableResp3: true;
};
export default _default;
//# sourceMappingURL=INFO_DEBUG.d.ts.map