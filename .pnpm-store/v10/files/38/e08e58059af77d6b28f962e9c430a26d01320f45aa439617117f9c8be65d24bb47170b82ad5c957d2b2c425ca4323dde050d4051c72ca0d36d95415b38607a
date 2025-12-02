import { CommandParser } from '../client/parser';
import { RedisArgument, NumberReply } from '../RESP/types';
export interface CopyCommandOptions {
    DB?: number;
    REPLACE?: boolean;
}
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Copies the value stored at the source key to the destination key
     * @param parser - The Redis command parser
     * @param source - Source key
     * @param destination - Destination key
     * @param options - Options for the copy operation
     */
    readonly parseCommand: (this: void, parser: CommandParser, source: RedisArgument, destination: RedisArgument, options?: CopyCommandOptions) => void;
    readonly transformReply: () => NumberReply;
};
export default _default;
//# sourceMappingURL=COPY.d.ts.map