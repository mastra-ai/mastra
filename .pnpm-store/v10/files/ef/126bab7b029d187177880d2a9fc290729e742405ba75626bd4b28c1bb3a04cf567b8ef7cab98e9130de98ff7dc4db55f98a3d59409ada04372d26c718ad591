import { CommandParser } from '../client/parser';
import { ArrayReply, TuplesToMapReply, BlobStringReply, NumberReply, UnwrapReply, Resp2Reply } from '../RESP/types';
export type ModuleListReply = ArrayReply<TuplesToMapReply<[
    [
        BlobStringReply<'name'>,
        BlobStringReply
    ],
    [
        BlobStringReply<'ver'>,
        NumberReply
    ]
]>>;
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: true;
    /**
     * Constructs the MODULE LIST command
     *
     * @param parser - The command parser
     * @see https://redis.io/commands/module-list/
     */
    readonly parseCommand: (this: void, parser: CommandParser) => void;
    readonly transformReply: {
        readonly 2: (reply: UnwrapReply<Resp2Reply<ModuleListReply>>) => {
            name: BlobStringReply<string>;
            ver: NumberReply<number>;
        }[];
        readonly 3: () => ModuleListReply;
    };
};
export default _default;
//# sourceMappingURL=MODULE_LIST.d.ts.map