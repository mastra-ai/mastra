import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument, SimpleStringReply } from '@redis/client/dist/lib/RESP/types';
import { TimeSeriesEncoding, TimeSeriesDuplicatePolicies, Labels } from './helpers';
import { TsIgnoreOptions } from './ADD';
export interface TsCreateOptions {
    RETENTION?: number;
    ENCODING?: TimeSeriesEncoding;
    CHUNK_SIZE?: number;
    DUPLICATE_POLICY?: TimeSeriesDuplicatePolicies;
    LABELS?: Labels;
    IGNORE?: TsIgnoreOptions;
}
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Creates a new time series
     * @param parser - The command parser
     * @param key - The key name for the new time series
     * @param options - Optional configuration parameters
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, options?: TsCreateOptions) => void;
    readonly transformReply: () => SimpleStringReply<'OK'>;
};
export default _default;
//# sourceMappingURL=CREATE.d.ts.map