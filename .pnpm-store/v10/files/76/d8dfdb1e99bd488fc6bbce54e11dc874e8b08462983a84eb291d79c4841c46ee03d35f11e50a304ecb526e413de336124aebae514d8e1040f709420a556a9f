import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument, NumberReply, BlobStringReply } from '@redis/client/dist/lib/RESP/types';
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Begins an incremental save of a Bloom Filter. This is useful for large filters that can't be saved at once
     * @param parser - The command parser
     * @param key - The name of the Bloom filter to save
     * @param iterator - Iterator value; Start at 0, and use the iterator from the response for the next chunk
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, iterator: number) => void;
    readonly transformReply: (this: void, reply: [NumberReply<number>, BlobStringReply<string>]) => {
        iterator: NumberReply<number>;
        chunk: BlobStringReply<string>;
    };
};
export default _default;
//# sourceMappingURL=SCANDUMP.d.ts.map