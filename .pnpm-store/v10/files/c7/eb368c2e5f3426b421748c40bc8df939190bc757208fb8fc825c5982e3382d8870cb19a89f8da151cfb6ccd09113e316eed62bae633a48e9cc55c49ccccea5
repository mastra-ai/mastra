import { CommandParser } from '../client/parser';
import { RedisArgument, SimpleStringReply } from '../RESP/types';
import { AuthOptions } from './AUTH';
export interface MigrateOptions {
    COPY?: true;
    REPLACE?: true;
    AUTH?: AuthOptions;
}
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Constructs the MIGRATE command
     *
     * @param parser - The command parser
     * @param host - Target Redis instance host
     * @param port - Target Redis instance port
     * @param key - Key or keys to migrate
     * @param destinationDb - Target database index
     * @param timeout - Timeout in milliseconds
     * @param options - Optional parameters including COPY, REPLACE, and AUTH
     * @see https://redis.io/commands/migrate/
     */
    readonly parseCommand: (this: void, parser: CommandParser, host: RedisArgument, port: number, key: RedisArgument | Array<RedisArgument>, destinationDb: number, timeout: number, options?: MigrateOptions) => void;
    readonly transformReply: () => SimpleStringReply<'OK'>;
};
export default _default;
//# sourceMappingURL=MIGRATE.d.ts.map