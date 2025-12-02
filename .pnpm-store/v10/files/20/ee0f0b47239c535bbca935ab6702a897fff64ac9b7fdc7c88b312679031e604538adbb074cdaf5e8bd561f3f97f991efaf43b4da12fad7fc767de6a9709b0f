import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument, SimpleStringReply } from '@redis/client/dist/lib/RESP/types';
interface BfMergeSketch {
    name: RedisArgument;
    weight: number;
}
export type BfMergeSketches = Array<RedisArgument> | Array<BfMergeSketch>;
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Merges multiple Count-Min Sketches into a single sketch, with optional weights
     * @param parser - The command parser
     * @param destination - The name of the destination sketch
     * @param source - Array of sketch names or array of sketches with weights
     */
    readonly parseCommand: (this: void, parser: CommandParser, destination: RedisArgument, source: BfMergeSketches) => void;
    readonly transformReply: () => SimpleStringReply<'OK'>;
};
export default _default;
//# sourceMappingURL=MERGE.d.ts.map