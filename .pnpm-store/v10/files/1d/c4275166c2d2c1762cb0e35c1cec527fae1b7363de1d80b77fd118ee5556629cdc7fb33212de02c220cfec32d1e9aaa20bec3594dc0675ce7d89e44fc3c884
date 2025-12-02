import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument, SimpleStringReply } from '@redis/client/dist/lib/RESP/types';
import { RedisVariadicArgument } from '@redis/client/dist/lib/commands/generic-transformers';
export interface TDigestMergeOptions {
    COMPRESSION?: number;
    OVERRIDE?: boolean;
}
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Merges multiple t-digest sketches into one, with optional compression and override settings
     * @param parser - The command parser
     * @param destination - The name of the destination t-digest sketch
     * @param source - One or more source sketch names to merge from
     * @param options - Optional parameters for merge operation
     * @param options.COMPRESSION - New compression value for merged sketch
     * @param options.OVERRIDE - If true, override destination sketch if it exists
     */
    readonly parseCommand: (this: void, parser: CommandParser, destination: RedisArgument, source: RedisVariadicArgument, options?: TDigestMergeOptions) => void;
    readonly transformReply: () => SimpleStringReply<'OK'>;
};
export default _default;
//# sourceMappingURL=MERGE.d.ts.map