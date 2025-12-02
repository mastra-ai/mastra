import { CommandParser } from "@redis/client/dist/lib/client/parser";
import { RedisArgument } from "@redis/client/dist/lib/RESP/types";
type RESPReply = Array<string | number | RESPReply>;
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Returns the JSON value at the specified path in RESP (Redis Serialization Protocol) format.
     * Returns the value in RESP form, useful for language-independent processing.
     *
     * @param parser - The Redis command parser
     * @param key - The key containing the JSON document
     * @param path - Optional path to the value in the document
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, path?: string) => void;
    readonly transformReply: () => RESPReply;
};
export default _default;
//# sourceMappingURL=RESP.d.ts.map