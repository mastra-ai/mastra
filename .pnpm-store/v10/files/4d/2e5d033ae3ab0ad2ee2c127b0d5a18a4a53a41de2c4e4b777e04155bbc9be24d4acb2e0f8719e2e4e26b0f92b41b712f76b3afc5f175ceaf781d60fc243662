import { CommandParser } from '../client/parser';
import { RedisArgument, SimpleStringReply } from '../RESP/types';
export declare const CLUSTER_SLOT_STATES: {
    readonly IMPORTING: "IMPORTING";
    readonly MIGRATING: "MIGRATING";
    readonly STABLE: "STABLE";
    readonly NODE: "NODE";
};
export type ClusterSlotState = typeof CLUSTER_SLOT_STATES[keyof typeof CLUSTER_SLOT_STATES];
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: true;
    /**
     * Assigns a hash slot to a specific Redis Cluster node
     * @param parser - The Redis command parser
     * @param slot - The slot number to assign
     * @param state - The state to set for the slot (IMPORTING, MIGRATING, STABLE, NODE)
     * @param nodeId - Node ID (required for IMPORTING, MIGRATING, and NODE states)
     */
    readonly parseCommand: (this: void, parser: CommandParser, slot: number, state: ClusterSlotState, nodeId?: RedisArgument) => void;
    readonly transformReply: () => SimpleStringReply<'OK'>;
};
export default _default;
//# sourceMappingURL=CLUSTER_SETSLOT.d.ts.map