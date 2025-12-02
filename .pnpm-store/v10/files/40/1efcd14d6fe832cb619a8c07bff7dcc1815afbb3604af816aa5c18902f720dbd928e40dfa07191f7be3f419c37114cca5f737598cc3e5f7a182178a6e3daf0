import { CommandParser } from '../client/parser';
import { RedisArgument, BlobStringReply, SimpleStringReply, DoubleReply } from '../RESP/types';
type RawVembReply = {
    quantization: SimpleStringReply;
    raw: BlobStringReply;
    l2Norm: DoubleReply;
    quantizationRange?: DoubleReply;
};
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Retrieve the RAW approximate vector associated with a vector set element
     *
     * @param parser - The command parser
     * @param key - The key of the vector set
     * @param element - The name of the element to retrieve the vector for
     * @see https://redis.io/commands/vemb/
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, element: RedisArgument) => void;
    readonly transformReply: {
        2: (reply: any[]) => RawVembReply;
        3: (reply: any[]) => RawVembReply;
    };
};
export default _default;
//# sourceMappingURL=VEMB_RAW.d.ts.map