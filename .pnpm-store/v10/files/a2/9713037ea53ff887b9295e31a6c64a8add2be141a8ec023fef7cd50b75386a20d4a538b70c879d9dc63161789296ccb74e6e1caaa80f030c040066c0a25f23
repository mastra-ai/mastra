import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument, SimpleStringReply } from '@redis/client/dist/lib/RESP/types';
export interface TDigestCreateOptions {
    COMPRESSION?: number;
}
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Creates a new t-digest sketch for storing distributions
     * @param parser - The command parser
     * @param key - The name of the t-digest sketch
     * @param options - Optional parameters for sketch creation
     * @param options.COMPRESSION - Compression parameter that affects performance and accuracy
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, options?: TDigestCreateOptions) => void;
    readonly transformReply: () => SimpleStringReply<'OK'>;
};
export default _default;
//# sourceMappingURL=CREATE.d.ts.map