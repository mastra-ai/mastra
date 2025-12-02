import { BlobStringReply } from '../RESP/types';
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Constructs the HSCAN command with NOVALUES option
     *
     * @param args - The same parameters as HSCAN command
     * @see https://redis.io/commands/hscan/
     */
    readonly parseCommand: (this: void, parser: import("../..").CommandParser, key: import("../RESP/types").RedisArgument, cursor: import("../RESP/types").RedisArgument, options?: import("./SCAN").ScanCommonOptions | undefined) => void;
    readonly transformReply: (this: void, [cursor, fields]: [BlobStringReply, Array<BlobStringReply>]) => {
        cursor: BlobStringReply<string>;
        fields: BlobStringReply<string>[];
    };
};
export default _default;
//# sourceMappingURL=HSCAN_NOVALUES.d.ts.map