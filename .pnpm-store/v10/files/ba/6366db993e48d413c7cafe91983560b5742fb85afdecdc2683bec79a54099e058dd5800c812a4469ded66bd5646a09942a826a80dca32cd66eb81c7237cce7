import { CommandParser } from '../client/parser';
import { RedisArgument, BlobStringReply } from '../RESP/types';
import { ScanCommonOptions } from './SCAN';
export interface HScanEntry {
    field: BlobStringReply;
    value: BlobStringReply;
}
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Constructs the HSCAN command
     *
     * @param parser - The command parser
     * @param key - The key of the hash to scan
     * @param cursor - The cursor position to start scanning from
     * @param options - Options for the scan (COUNT, MATCH, TYPE)
     * @see https://redis.io/commands/hscan/
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, cursor: RedisArgument, options?: ScanCommonOptions) => void;
    readonly transformReply: (this: void, [cursor, rawEntries]: [BlobStringReply, Array<BlobStringReply>]) => {
        cursor: BlobStringReply<string>;
        entries: {
            field: BlobStringReply<string>;
            value: BlobStringReply<string>;
        }[];
    };
};
export default _default;
//# sourceMappingURL=HSCAN.d.ts.map