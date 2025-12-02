import { CommandParser } from '../client/parser';
import { MapReply, BlobStringReply } from '../RESP/types';
import { RedisVariadicArgument } from './generic-transformers';
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: true;
    /**
     * Gets the values of configuration parameters
     * @param parser - The Redis command parser
     * @param parameters - Pattern or specific configuration parameter names
     */
    readonly parseCommand: (this: void, parser: CommandParser, parameters: RedisVariadicArgument) => void;
    readonly transformReply: {
        readonly 2: (reply: import("../RESP/types").ArrayReply<BlobStringReply<string>>, preserve?: any, typeMapping?: import("../RESP/types").TypeMapping | undefined) => MapReply<BlobStringReply<string>, BlobStringReply<string>>;
        readonly 3: () => MapReply<BlobStringReply, BlobStringReply>;
    };
};
export default _default;
//# sourceMappingURL=CONFIG_GET.d.ts.map