import { CommandParser } from '../client/parser';
import { RedisArgument, BlobStringReply, NullReply, ArrayReply, TuplesReply, NumberReply } from '../RESP/types';
declare const _default: {
    readonly CACHEABLE: true;
    readonly IS_READ_ONLY: true;
    /**
     * Constructs the XPENDING command to inspect pending messages of a consumer group
     *
     * @param parser - The command parser
     * @param key - The stream key
     * @param group - Name of the consumer group
     * @returns Summary of pending messages including total count, ID range, and per-consumer stats
     * @see https://redis.io/commands/xpending/
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, group: RedisArgument) => void;
    /**
     * Transforms the raw XPENDING reply into a structured object
     *
     * @param reply - Raw reply from Redis
     * @returns Object containing pending count, ID range, and consumer statistics
     */
    readonly transformReply: (this: void, reply: [pending: NumberReply<number>, firstId: NullReply | BlobStringReply<string>, lastId: NullReply | BlobStringReply<string>, consumers: NullReply | ArrayReply<TuplesReply<[name: BlobStringReply<string>, deliveriesCounter: BlobStringReply<string>]>>]) => {
        pending: NumberReply<number>;
        firstId: NullReply | BlobStringReply<string>;
        lastId: NullReply | BlobStringReply<string>;
        consumers: {
            name: BlobStringReply<string>;
            deliveriesCounter: number;
        }[] | null;
    };
};
export default _default;
//# sourceMappingURL=XPENDING.d.ts.map