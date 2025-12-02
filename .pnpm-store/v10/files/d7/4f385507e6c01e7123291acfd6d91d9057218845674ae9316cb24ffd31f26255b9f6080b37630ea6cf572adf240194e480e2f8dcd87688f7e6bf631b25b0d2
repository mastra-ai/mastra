import { CommandParser } from '../client/parser';
import { RedisArgument, SimpleStringReply, BlobStringReply } from '../RESP/types';
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: true;
    /**
     * Simulates ACL operations without executing them
     * @param parser - The Redis command parser
     * @param username - Username to simulate ACL operations for
     * @param command - Command arguments to simulate
     */
    readonly parseCommand: (this: void, parser: CommandParser, username: RedisArgument, command: Array<RedisArgument>) => void;
    readonly transformReply: () => SimpleStringReply<'OK'> | BlobStringReply;
};
export default _default;
//# sourceMappingURL=ACL_DRYRUN.d.ts.map