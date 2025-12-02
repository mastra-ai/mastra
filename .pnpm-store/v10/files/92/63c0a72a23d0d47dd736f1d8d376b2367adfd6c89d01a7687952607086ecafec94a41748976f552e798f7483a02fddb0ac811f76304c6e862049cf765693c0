import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument, SimpleStringReply, NumberReply } from '@redis/client/dist/lib/RESP/types';
export interface FtDropIndexOptions {
    DD?: true;
}
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: true;
    /**
     * Deletes an index and all associated documents.
     * @param parser - The command parser
     * @param index - Name of the index to delete
     * @param options - Optional parameters:
     *   - DD: Also delete the indexed documents themselves
     */
    readonly parseCommand: (this: void, parser: CommandParser, index: RedisArgument, options?: FtDropIndexOptions) => void;
    readonly transformReply: {
        readonly 2: () => SimpleStringReply<'OK'>;
        readonly 3: () => NumberReply;
    };
};
export default _default;
//# sourceMappingURL=DROPINDEX.d.ts.map