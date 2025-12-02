import { CommandParser } from '../client/parser';
import { RedisArgument, ReplyUnion } from '../RESP/types';
export interface EvalOptions {
    keys?: Array<RedisArgument>;
    arguments?: Array<RedisArgument>;
}
export declare function parseEvalArguments(parser: CommandParser, script: RedisArgument, options?: EvalOptions): void;
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Executes a Lua script server side
     * @param parser - The Redis command parser
     * @param script - Lua script to execute
     * @param options - Script execution options including keys and arguments
     */
    readonly parseCommand: (this: void, parser: CommandParser, script: RedisArgument, options?: EvalOptions | undefined) => void;
    readonly transformReply: () => ReplyUnion;
};
export default _default;
//# sourceMappingURL=EVAL.d.ts.map