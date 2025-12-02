import { CommandParser } from '../client/parser';
import { RedisArgument, SimpleStringReply } from '../RESP/types';
export interface AuthOptions {
    username?: RedisArgument;
    password: RedisArgument;
}
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: true;
    /**
     * Authenticates the connection using a password or username and password
     * @param parser - The Redis command parser
     * @param options - Authentication options containing username and/or password
     * @param options.username - Optional username for authentication
     * @param options.password - Password for authentication
     */
    readonly parseCommand: (this: void, parser: CommandParser, { username, password }: AuthOptions) => void;
    readonly transformReply: () => SimpleStringReply<'OK'>;
};
export default _default;
//# sourceMappingURL=AUTH.d.ts.map