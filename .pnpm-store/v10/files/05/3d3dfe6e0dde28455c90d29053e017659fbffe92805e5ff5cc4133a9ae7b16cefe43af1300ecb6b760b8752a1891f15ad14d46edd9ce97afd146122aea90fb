import { CommandArguments, RedisScript, ReplyUnion, TransformReply, TypeMapping } from './RESP/types';
export type MULTI_REPLY = {
    GENERIC: 'generic';
    TYPED: 'typed';
};
export type MULTI_MODE = {
    TYPED: 'typed';
    UNTYPED: 'untyped';
};
export type MultiMode = MULTI_MODE[keyof MULTI_MODE];
export type MultiReply = MULTI_REPLY[keyof MULTI_REPLY];
export type MultiReplyType<T extends MultiReply, REPLIES> = T extends MULTI_REPLY['TYPED'] ? REPLIES : Array<ReplyUnion>;
export interface RedisMultiQueuedCommand {
    args: CommandArguments;
    transformReply?: TransformReply;
}
export default class RedisMultiCommand {
    private readonly typeMapping?;
    constructor(typeMapping?: TypeMapping);
    readonly queue: Array<RedisMultiQueuedCommand>;
    readonly scriptsInUse: Set<string>;
    addCommand(args: CommandArguments, transformReply?: TransformReply): void;
    addScript(script: RedisScript, args: CommandArguments, transformReply?: TransformReply): void;
    transformReplies(rawReplies: Array<unknown>): Array<unknown>;
}
//# sourceMappingURL=multi-command.d.ts.map