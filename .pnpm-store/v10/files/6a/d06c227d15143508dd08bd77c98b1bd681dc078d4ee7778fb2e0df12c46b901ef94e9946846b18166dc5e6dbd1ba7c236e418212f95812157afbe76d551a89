import { CommandParser } from '../client/parser';
import { NumberReply } from '../RESP/types';
export declare const CLIENT_KILL_FILTERS: {
    readonly ADDRESS: "ADDR";
    readonly LOCAL_ADDRESS: "LADDR";
    readonly ID: "ID";
    readonly TYPE: "TYPE";
    readonly USER: "USER";
    readonly SKIP_ME: "SKIPME";
    readonly MAXAGE: "MAXAGE";
};
type CLIENT_KILL_FILTERS = typeof CLIENT_KILL_FILTERS;
export interface ClientKillFilterCommon<T extends CLIENT_KILL_FILTERS[keyof CLIENT_KILL_FILTERS]> {
    filter: T;
}
export interface ClientKillAddress extends ClientKillFilterCommon<CLIENT_KILL_FILTERS['ADDRESS']> {
    address: `${string}:${number}`;
}
export interface ClientKillLocalAddress extends ClientKillFilterCommon<CLIENT_KILL_FILTERS['LOCAL_ADDRESS']> {
    localAddress: `${string}:${number}`;
}
export interface ClientKillId extends ClientKillFilterCommon<CLIENT_KILL_FILTERS['ID']> {
    id: number | `${number}`;
}
export interface ClientKillType extends ClientKillFilterCommon<CLIENT_KILL_FILTERS['TYPE']> {
    type: 'normal' | 'master' | 'replica' | 'pubsub';
}
export interface ClientKillUser extends ClientKillFilterCommon<CLIENT_KILL_FILTERS['USER']> {
    username: string;
}
export type ClientKillSkipMe = CLIENT_KILL_FILTERS['SKIP_ME'] | (ClientKillFilterCommon<CLIENT_KILL_FILTERS['SKIP_ME']> & {
    skipMe: boolean;
});
export interface ClientKillMaxAge extends ClientKillFilterCommon<CLIENT_KILL_FILTERS['MAXAGE']> {
    maxAge: number;
}
export type ClientKillFilter = ClientKillAddress | ClientKillLocalAddress | ClientKillId | ClientKillType | ClientKillUser | ClientKillSkipMe | ClientKillMaxAge;
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: true;
    /**
     * Closes client connections matching the specified filters
     * @param parser - The Redis command parser
     * @param filters - One or more filters to match client connections to kill
     */
    readonly parseCommand: (this: void, parser: CommandParser, filters: ClientKillFilter | Array<ClientKillFilter>) => void;
    readonly transformReply: () => NumberReply;
};
export default _default;
//# sourceMappingURL=CLIENT_KILL.d.ts.map