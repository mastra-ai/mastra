import { CommandParser } from '../client/parser';
import { ArrayReply, BlobStringReply, NumberReply } from '../RESP/types';
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: true;
    /**
     * Constructs the LATENCY LATEST command
     *
     * @param parser - The command parser
     * @see https://redis.io/commands/latency-latest/
     */
    readonly parseCommand: (this: void, parser: CommandParser) => void;
    readonly transformReply: () => ArrayReply<[
        name: BlobStringReply,
        timestamp: NumberReply,
        latestLatency: NumberReply,
        allTimeLatency: NumberReply
    ]>;
};
export default _default;
//# sourceMappingURL=LATENCY_LATEST.d.ts.map