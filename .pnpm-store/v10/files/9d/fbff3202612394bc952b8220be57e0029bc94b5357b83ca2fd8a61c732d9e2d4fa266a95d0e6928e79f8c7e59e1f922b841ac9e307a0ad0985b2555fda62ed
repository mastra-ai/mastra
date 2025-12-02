import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { Timestamp } from './helpers';
import { ArrayReply, NumberReply, SimpleErrorReply } from '@redis/client/dist/lib/RESP/types';
export interface TsMAddSample {
    key: string;
    timestamp: Timestamp;
    value: number;
}
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Adds multiple samples to multiple time series
     * @param parser - The command parser
     * @param toAdd - Array of samples to add to different time series
     */
    readonly parseCommand: (this: void, parser: CommandParser, toAdd: Array<TsMAddSample>) => void;
    readonly transformReply: () => ArrayReply<NumberReply | SimpleErrorReply>;
};
export default _default;
//# sourceMappingURL=MADD.d.ts.map