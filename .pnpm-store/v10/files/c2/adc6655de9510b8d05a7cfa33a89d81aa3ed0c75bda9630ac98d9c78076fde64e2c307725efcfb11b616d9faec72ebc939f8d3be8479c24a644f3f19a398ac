import { CommandParser } from '../client/parser';
import { SimpleStringReply } from '../RESP/types';
export interface ClusterResetOptions {
    mode?: 'HARD' | 'SOFT';
}
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: true;
    /**
     * Resets a Redis Cluster node, clearing all information and returning it to a brand new state
     * @param parser - The Redis command parser
     * @param options - Options for the reset operation
     */
    readonly parseCommand: (this: void, parser: CommandParser, options?: ClusterResetOptions) => void;
    readonly transformReply: () => SimpleStringReply<'OK'>;
};
export default _default;
//# sourceMappingURL=CLUSTER_RESET.d.ts.map