import type { Message } from "../types.js";
import type { BoolValue, BytesValue, DoubleValue, FloatValue, Int32Value, Int64Value, StringValue, UInt32Value, UInt64Value } from "./gen/google/protobuf/wrappers_pb.js";
import type { DescField, DescMessage } from "../descriptors.js";
export declare function isWrapper(arg: Message): arg is DoubleValue | FloatValue | Int64Value | UInt64Value | Int32Value | UInt32Value | BoolValue | StringValue | BytesValue;
export type WktWrapperDesc = DescMessage & {
    fields: [
        DescField & {
            fieldKind: "scalar";
            number: 1;
            name: "value";
            oneof: undefined;
        }
    ];
};
export declare function isWrapperDesc(messageDesc: DescMessage): messageDesc is WktWrapperDesc;
