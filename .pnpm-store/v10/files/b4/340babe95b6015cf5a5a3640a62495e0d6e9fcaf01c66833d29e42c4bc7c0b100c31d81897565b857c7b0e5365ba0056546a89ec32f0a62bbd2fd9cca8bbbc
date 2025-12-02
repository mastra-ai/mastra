import { CommandParser } from '../client/parser';
import { RedisArgument, SimpleStringReply } from '../RESP/types';
export type MSetArguments = Array<[RedisArgument, RedisArgument]> | Array<RedisArgument> | Record<string, RedisArgument>;
export declare function parseMSetArguments(parser: CommandParser, toSet: MSetArguments): void;
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Constructs the MSET command
     *
     * @param parser - The command parser
     * @param toSet - Key-value pairs to set (array of tuples, flat array, or object)
     * @see https://redis.io/commands/mset/
     */
    readonly parseCommand: (this: void, parser: CommandParser, toSet: MSetArguments) => void;
    readonly transformReply: () => SimpleStringReply<'OK'>;
};
export default _default;
//# sourceMappingURL=MSET.d.ts.map