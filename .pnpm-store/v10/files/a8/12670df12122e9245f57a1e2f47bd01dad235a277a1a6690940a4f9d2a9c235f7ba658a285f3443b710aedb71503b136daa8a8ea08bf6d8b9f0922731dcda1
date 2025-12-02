import { CommandParser } from '../client/parser';
import { RedisArgument, SimpleStringReply } from '../RESP/types';
import { RedisVariadicArgument } from './generic-transformers';
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: true;
    /**
     * Creates or modifies ACL user with specified rules
     * @param parser - The Redis command parser
     * @param username - Username to create or modify
     * @param rule - ACL rule(s) to apply to the user
     */
    readonly parseCommand: (this: void, parser: CommandParser, username: RedisArgument, rule: RedisVariadicArgument) => void;
    readonly transformReply: () => SimpleStringReply<'OK'>;
};
export default _default;
//# sourceMappingURL=ACL_SETUSER.d.ts.map