import { CommandParser } from '../client/parser';
import { RedisArgument, VerbatimStringReply } from '../RESP/types';
import { ClientInfoReply } from './CLIENT_INFO';
export interface ListFilterType {
    TYPE: 'NORMAL' | 'MASTER' | 'REPLICA' | 'PUBSUB';
    ID?: never;
}
export interface ListFilterId {
    ID: Array<RedisArgument>;
    TYPE?: never;
}
export type ListFilter = ListFilterType | ListFilterId;
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: true;
    /**
     * Returns information about all client connections. Can be filtered by type or ID
     * @param parser - The Redis command parser
     * @param filter - Optional filter to return only specific client types or IDs
     */
    readonly parseCommand: (this: void, parser: CommandParser, filter?: ListFilter) => void;
    readonly transformReply: (this: void, rawReply: VerbatimStringReply) => Array<ClientInfoReply>;
};
export default _default;
//# sourceMappingURL=CLIENT_LIST.d.ts.map