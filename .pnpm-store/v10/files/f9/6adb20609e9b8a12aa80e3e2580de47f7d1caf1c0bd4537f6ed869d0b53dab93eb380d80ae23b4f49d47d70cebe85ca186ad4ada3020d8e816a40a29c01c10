import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { ReplyUnion, UnwrapReply } from '@redis/client/dist/lib/RESP/types';
import { FtAggregateOptions } from './AGGREGATE';
import { ProfileOptions, ProfileReplyResp2 } from './PROFILE_SEARCH';
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: true;
    /**
     * Profiles the execution of an aggregation query for performance analysis.
     * @param parser - The command parser
     * @param index - Name of the index to profile query against
     * @param query - The aggregation query to profile
     * @param options - Optional parameters:
     *   - LIMITED: Collect limited timing information only
     *   - All options supported by FT.AGGREGATE command
     */
    readonly parseCommand: (this: void, parser: CommandParser, index: string, query: string, options?: ProfileOptions & FtAggregateOptions) => void;
    readonly transformReply: {
        readonly 2: (reply: [[total: UnwrapReply<import("@redis/client/dist/lib/RESP/types").NumberReply<number>>, ...results: import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>[]], import("@redis/client/dist/lib/RESP/types").ArrayReply<ReplyUnion>]) => ProfileReplyResp2;
        readonly 3: (reply: ReplyUnion) => ReplyUnion;
    };
    readonly unstableResp3: true;
};
export default _default;
//# sourceMappingURL=PROFILE_AGGREGATE.d.ts.map