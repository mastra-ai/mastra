import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument, ReplyUnion } from '@redis/client/dist/lib/RESP/types';
export interface Terms {
    mode: 'INCLUDE' | 'EXCLUDE';
    dictionary: RedisArgument;
}
export interface FtSpellCheckOptions {
    DISTANCE?: number;
    TERMS?: Terms | Array<Terms>;
    DIALECT?: number;
}
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: true;
    /**
     * Performs spelling correction on a search query.
     * @param parser - The command parser
     * @param index - Name of the index to use for spelling corrections
     * @param query - The search query to check for spelling
     * @param options - Optional parameters:
     *   - DISTANCE: Maximum Levenshtein distance for spelling suggestions
     *   - TERMS: Custom dictionary terms to include/exclude
     *   - DIALECT: Version of query dialect to use (defaults to 1)
     */
    readonly parseCommand: (this: void, parser: CommandParser, index: RedisArgument, query: RedisArgument, options?: FtSpellCheckOptions) => void;
    readonly transformReply: {
        readonly 2: (rawReply: SpellCheckRawReply) => SpellCheckReply;
        readonly 3: () => ReplyUnion;
    };
    readonly unstableResp3: true;
};
export default _default;
type SpellCheckRawReply = Array<[
    _: string,
    term: string,
    suggestions: Array<[score: string, suggestion: string]>
]>;
type SpellCheckReply = Array<{
    term: string;
    suggestions: Array<{
        score: number;
        suggestion: string;
    }>;
}>;
//# sourceMappingURL=SPELLCHECK.d.ts.map