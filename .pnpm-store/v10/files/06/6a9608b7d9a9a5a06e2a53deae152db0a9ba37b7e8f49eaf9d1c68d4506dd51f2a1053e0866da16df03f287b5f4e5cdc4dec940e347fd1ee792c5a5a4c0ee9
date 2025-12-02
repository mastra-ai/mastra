import { CommandParser } from '../client/parser';
import { SimpleStringReply } from '../RESP/types';
interface FailoverOptions {
    TO?: {
        host: string;
        port: number;
        FORCE?: true;
    };
    ABORT?: true;
    TIMEOUT?: number;
}
declare const _default: {
    /**
     * Starts a coordinated failover between the primary and a replica
     * @param parser - The Redis command parser
     * @param options - Failover options including target host, abort flag, and timeout
     */
    readonly parseCommand: (this: void, parser: CommandParser, options?: FailoverOptions) => void;
    readonly transformReply: () => SimpleStringReply;
};
export default _default;
//# sourceMappingURL=FAILOVER.d.ts.map