import { CommandParser } from '../client/parser';
import { RedisArgument } from '../RESP/types';
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Retrieve the approximate vector associated with a vector set element
     *
     * @param parser - The command parser
     * @param key - The key of the vector set
     * @param element - The name of the element to retrieve the vector for
     * @see https://redis.io/commands/vemb/
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, element: RedisArgument) => void;
    readonly transformReply: {
        2: (reply: import("../RESP/types").BlobStringReply<string>[], preserve?: any, typeMapping?: import("../RESP/types").TypeMapping | undefined) => import("../RESP/types").DoubleReply<number>[];
        3: () => import("../RESP/types").ArrayReply<import("../RESP/types").DoubleReply<number>>;
    };
};
export default _default;
//# sourceMappingURL=VEMB.d.ts.map