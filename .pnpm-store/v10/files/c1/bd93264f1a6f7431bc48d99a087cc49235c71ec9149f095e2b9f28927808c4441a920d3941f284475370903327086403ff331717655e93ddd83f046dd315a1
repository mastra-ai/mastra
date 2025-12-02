/// <reference types="node" />
import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument, SimpleStringReply } from '@redis/client/dist/lib/RESP/types';
type FtConfigProperties = 'a' | 'b' | (string & {}) | Buffer;
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: true;
    /**
     * Sets a RediSearch configuration option value.
     * @param parser - The command parser
     * @param property - The name of the configuration option to set
     * @param value - The value to set for the configuration option
     */
    readonly parseCommand: (this: void, parser: CommandParser, property: FtConfigProperties, value: RedisArgument) => void;
    readonly transformReply: () => SimpleStringReply<'OK'>;
};
export default _default;
//# sourceMappingURL=CONFIG_SET.d.ts.map