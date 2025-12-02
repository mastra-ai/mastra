import { Long } from "../../vendor/long.js";
import { Logger } from "../logging.js";
import { QueryId, Transition } from "./protocol.js";
import { FunctionResult } from "./function_result.js";
/**
 * A represention of the query results we've received on the current WebSocket
 * connection.
 *
 * Queries you won't find here include:
 * - queries which have been requested, but no query transition has been received yet for
 * - queries which are populated only though active optimistic updates, but are not subscribed to
 * - queries which have already been removed by the server (which it shouldn't do unless that's
 *   been requested by the client)
 */
export declare class RemoteQuerySet {
    private version;
    private readonly remoteQuerySet;
    private readonly queryPath;
    private readonly logger;
    constructor(queryPath: (queryId: QueryId) => string | null, logger: Logger);
    transition(transition: Transition): void;
    remoteQueryResults(): Map<QueryId, FunctionResult>;
    timestamp(): Long;
}
//# sourceMappingURL=remote_query_set.d.ts.map