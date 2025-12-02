import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { SimpleStringReply, RedisArgument, NumberReply, UnwrapReply } from '@redis/client/dist/lib/RESP/types';
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: true;
    /**
     * Deletes a cursor from an index.
     * @param parser - The command parser
     * @param index - The index name that contains the cursor
     * @param cursorId - The cursor ID to delete
     */
    readonly parseCommand: (this: void, parser: CommandParser, index: RedisArgument, cursorId: UnwrapReply<NumberReply>) => void;
    readonly transformReply: () => SimpleStringReply<'OK'>;
};
export default _default;
//# sourceMappingURL=CURSOR_DEL.d.ts.map