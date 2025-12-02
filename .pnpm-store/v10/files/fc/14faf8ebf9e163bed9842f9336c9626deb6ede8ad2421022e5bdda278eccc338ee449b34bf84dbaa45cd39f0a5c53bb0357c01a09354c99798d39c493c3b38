import { CommandParser } from '../client/parser';
import { RedisArgument } from '../RESP/types';
declare const _default: {
    /**
     * Set or replace attributes on a vector set element
     *
     * @param parser - The command parser
     * @param key - The key of the vector set
     * @param element - The name of the element to set attributes for
     * @param attributes - The attributes to set (as JSON string or object)
     * @see https://redis.io/commands/vsetattr/
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, element: RedisArgument, attributes: RedisArgument | Record<string, any>) => void;
    readonly transformReply: {
        2: (reply: import("../RESP/types").NumberReply<0 | 1>) => boolean;
        3: () => import("../RESP/types").BooleanReply<boolean>;
    };
};
export default _default;
//# sourceMappingURL=VSETATTR.d.ts.map