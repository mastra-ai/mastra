import { CommandParser } from '../client/parser';
import { RedisArgument, BlobStringReply } from '../RESP/types';
import { ScanCommonOptions } from './SCAN';
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Constructs the SSCAN command to incrementally iterate over elements in a set
     *
     * @param parser - The command parser
     * @param key - The key of the set to scan
     * @param cursor - The cursor position to start scanning from
     * @param options - Optional scanning parameters (COUNT and MATCH)
     * @returns Iterator containing cursor position and matching members
     * @see https://redis.io/commands/sscan/
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, cursor: RedisArgument, options?: ScanCommonOptions) => void;
    /**
     * Transforms the SSCAN reply into a cursor result object
     *
     * @param cursor - The next cursor position
     * @param members - Array of matching set members
     * @returns Object containing cursor and members array
     */
    readonly transformReply: (this: void, [cursor, members]: [BlobStringReply, Array<BlobStringReply>]) => {
        cursor: BlobStringReply<string>;
        members: BlobStringReply<string>[];
    };
};
export default _default;
//# sourceMappingURL=SSCAN.d.ts.map