import { CommandParser } from '../client/parser';
import { ArrayReply, BlobStringReply, NumberReply, UnwrapReply } from '../RESP/types';
import { RedisVariadicArgument } from './generic-transformers';
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Constructs the PUBSUB SHARDNUMSUB command
     *
     * @param parser - The command parser
     * @param channels - Optional shard channel names to get subscription count for
     * @see https://redis.io/commands/pubsub-shardnumsub/
     */
    readonly parseCommand: (this: void, parser: CommandParser, channels?: RedisVariadicArgument) => void;
    /**
     * Transforms the PUBSUB SHARDNUMSUB reply into a record of shard channel name to subscriber count
     *
     * @param reply - The raw reply from Redis
     * @returns Record mapping shard channel names to their subscriber counts
     */
    readonly transformReply: (this: void, reply: UnwrapReply<ArrayReply<BlobStringReply | NumberReply>>) => Record<string, NumberReply<number>>;
};
export default _default;
//# sourceMappingURL=PUBSUB_SHARDNUMSUB.d.ts.map