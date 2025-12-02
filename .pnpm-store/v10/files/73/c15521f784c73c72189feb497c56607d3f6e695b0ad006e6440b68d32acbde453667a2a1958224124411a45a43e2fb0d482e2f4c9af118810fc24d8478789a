import { CommandParser } from '../client/parser';
import { RedisArgument, ArrayReply, BlobStringReply } from '../RESP/types';
export interface VSimOptions {
    COUNT?: number;
    EPSILON?: number;
    EF?: number;
    FILTER?: string;
    'FILTER-EF'?: number;
    TRUTH?: boolean;
    NOTHREAD?: boolean;
}
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Retrieve elements similar to a given vector or element with optional filtering
     *
     * @param parser - The command parser
     * @param key - The key of the vector set
     * @param query - The query vector (array of numbers) or element name (string)
     * @param options - Optional parameters for similarity search
     * @see https://redis.io/commands/vsim/
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, query: RedisArgument | Array<number>, options?: VSimOptions) => void;
    readonly transformReply: () => ArrayReply<BlobStringReply>;
};
export default _default;
//# sourceMappingURL=VSIM.d.ts.map