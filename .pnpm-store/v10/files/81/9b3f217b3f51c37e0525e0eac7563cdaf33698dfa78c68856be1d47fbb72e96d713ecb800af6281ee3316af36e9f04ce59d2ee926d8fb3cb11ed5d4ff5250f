import { CommandParser } from '../client/parser';
import { SimpleStringReply } from '../RESP/types';
import { RedisVariadicArgument } from './generic-transformers';
interface CommonOptions {
    REDIRECT?: number;
    NOLOOP?: boolean;
}
interface BroadcastOptions {
    BCAST?: boolean;
    PREFIX?: RedisVariadicArgument;
}
interface OptInOptions {
    OPTIN?: boolean;
}
interface OptOutOptions {
    OPTOUT?: boolean;
}
export type ClientTrackingOptions = CommonOptions & (BroadcastOptions | OptInOptions | OptOutOptions);
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: true;
    /**
     * Controls server-assisted client side caching for the current connection
     * @param parser - The Redis command parser
     * @param mode - Whether to enable (true) or disable (false) tracking
     * @param options - Optional configuration including REDIRECT, BCAST, PREFIX, OPTIN, OPTOUT, and NOLOOP options
     */
    readonly parseCommand: <M extends boolean>(parser: CommandParser, mode: M, options?: (M extends true ? ClientTrackingOptions : never) | undefined) => void;
    readonly transformReply: () => SimpleStringReply<'OK'>;
};
export default _default;
//# sourceMappingURL=CLIENT_TRACKING.d.ts.map