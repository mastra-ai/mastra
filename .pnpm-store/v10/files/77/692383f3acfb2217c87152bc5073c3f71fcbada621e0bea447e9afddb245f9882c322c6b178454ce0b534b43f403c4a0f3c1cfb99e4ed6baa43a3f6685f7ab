import { CommandParser } from '../client/parser';
import { ArrayReply, BlobStringReply, NumberReply, UnwrapReply } from '../RESP/types';
import { RedisVariadicArgument } from './generic-transformers';
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: true;
    /**
     * Constructs the PUBSUB NUMSUB command
     *
     * @param parser - The command parser
     * @param channels - Optional channel names to get subscription count for
     * @see https://redis.io/commands/pubsub-numsub/
     */
    readonly parseCommand: (this: void, parser: CommandParser, channels?: RedisVariadicArgument) => void;
    /**
     * Transforms the PUBSUB NUMSUB reply into a record of channel name to subscriber count
     *
     * @param rawReply - The raw reply from Redis
     * @returns Record mapping channel names to their subscriber counts
     */
    readonly transformReply: (this: void, rawReply: UnwrapReply<ArrayReply<BlobStringReply | NumberReply>>) => Record<string, NumberReply<number>>;
};
export default _default;
//# sourceMappingURL=PUBSUB_NUMSUB.d.ts.map