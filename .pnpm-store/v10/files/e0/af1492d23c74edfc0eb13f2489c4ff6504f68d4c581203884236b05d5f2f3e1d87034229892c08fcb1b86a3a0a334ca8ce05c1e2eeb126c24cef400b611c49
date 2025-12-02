import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument, ArrayReply, NumberReply } from '@redis/client/dist/lib/RESP/types';
export interface BfIncrByItem {
    item: RedisArgument;
    incrementBy: number;
}
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Increases the count of one or more items in a Count-Min Sketch
     * @param parser - The command parser
     * @param key - The name of the sketch
     * @param items - A single item or array of items to increment, each with an item and increment value
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, items: BfIncrByItem | Array<BfIncrByItem>) => void;
    readonly transformReply: () => ArrayReply<NumberReply>;
};
export default _default;
//# sourceMappingURL=INCRBY.d.ts.map