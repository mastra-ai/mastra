import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument, ArrayReply, SimpleStringReply, NullReply } from '@redis/client/dist/lib/RESP/types';
export interface TopKIncrByItem {
    item: string;
    incrementBy: number;
}
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Increases the score of one or more items in a Top-K filter by specified increments
     * @param parser - The command parser
     * @param key - The name of the Top-K filter
     * @param items - A single item or array of items to increment, each with an item name and increment value
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, items: TopKIncrByItem | Array<TopKIncrByItem>) => void;
    readonly transformReply: () => ArrayReply<SimpleStringReply | NullReply>;
};
export default _default;
//# sourceMappingURL=INCRBY.d.ts.map