import { CommandParser } from '../client/parser';
import { ArrayReply, BlobStringReply } from '../RESP/types';
import { ZKeys } from './generic-transformers';
export interface ZUnionOptions {
    AGGREGATE?: 'SUM' | 'MIN' | 'MAX';
}
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Returns the union of multiple sorted sets.
     * @param parser - The Redis command parser.
     * @param keys - Keys of the sorted sets to combine.
     * @param options - Optional parameters for the union operation.
     */
    readonly parseCommand: (this: void, parser: CommandParser, keys: ZKeys, options?: ZUnionOptions) => void;
    readonly transformReply: () => ArrayReply<BlobStringReply>;
};
export default _default;
//# sourceMappingURL=ZUNION.d.ts.map