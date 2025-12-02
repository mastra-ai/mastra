import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument, TuplesReply, NumberReply, DoubleReply, UnwrapReply, Resp2Reply } from '@redis/client/dist/lib/RESP/types';
export interface TsGetOptions {
    LATEST?: boolean;
}
export type TsGetReply = TuplesReply<[]> | TuplesReply<[NumberReply, DoubleReply]>;
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Gets the last sample of a time series
     * @param parser - The command parser
     * @param key - The key name of the time series
     * @param options - Optional parameters for the command
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, options?: TsGetOptions) => void;
    readonly transformReply: {
        readonly 2: (this: void, reply: UnwrapReply<Resp2Reply<TsGetReply>>) => {
            timestamp: NumberReply<number>;
            value: number;
        } | null;
        readonly 3: (this: void, reply: UnwrapReply<TsGetReply>) => {
            timestamp: NumberReply<number>;
            value: DoubleReply<number>;
        } | null;
    };
};
export default _default;
//# sourceMappingURL=GET.d.ts.map