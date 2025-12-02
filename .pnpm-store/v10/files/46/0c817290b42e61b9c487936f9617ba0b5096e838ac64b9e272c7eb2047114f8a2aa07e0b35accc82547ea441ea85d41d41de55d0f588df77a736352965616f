import { jsonToConvex } from "../../values/index.js";
import { Long } from "../../vendor/long.js";
import { logForFunction, Logger } from "../logging.js";
import { QueryId, StateVersion, Transition } from "./protocol.js";
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
export class RemoteQuerySet {
  private version: StateVersion;
  private readonly remoteQuerySet: Map<QueryId, FunctionResult>;
  private readonly queryPath: (queryId: QueryId) => string | null;
  private readonly logger: Logger;

  constructor(queryPath: (queryId: QueryId) => string | null, logger: Logger) {
    this.version = { querySet: 0, ts: Long.fromNumber(0), identity: 0 };
    this.remoteQuerySet = new Map();
    this.queryPath = queryPath;
    this.logger = logger;
  }

  transition(transition: Transition): void {
    const start = transition.startVersion;
    if (
      this.version.querySet !== start.querySet ||
      this.version.ts.notEquals(start.ts) ||
      this.version.identity !== start.identity
    ) {
      throw new Error(
        `Invalid start version: ${start.ts.toString()}:${start.querySet}:${start.identity}, transitioning from ${this.version.ts.toString()}:${this.version.querySet}:${this.version.identity}`,
      );
    }
    for (const modification of transition.modifications) {
      switch (modification.type) {
        case "QueryUpdated": {
          const queryPath = this.queryPath(modification.queryId);
          if (queryPath) {
            for (const line of modification.logLines) {
              logForFunction(this.logger, "info", "query", queryPath, line);
            }
          }
          const value = jsonToConvex(modification.value ?? null);
          this.remoteQuerySet.set(modification.queryId, {
            success: true,
            value,
            logLines: modification.logLines,
          });
          break;
        }
        case "QueryFailed": {
          const queryPath = this.queryPath(modification.queryId);
          if (queryPath) {
            for (const line of modification.logLines) {
              logForFunction(this.logger, "info", "query", queryPath, line);
            }
          }
          const { errorData } = modification;
          this.remoteQuerySet.set(modification.queryId, {
            success: false,
            errorMessage: modification.errorMessage,
            errorData:
              errorData !== undefined ? jsonToConvex(errorData) : undefined,
            logLines: modification.logLines,
          });
          break;
        }
        case "QueryRemoved": {
          this.remoteQuerySet.delete(modification.queryId);
          break;
        }
        default: {
          // Enforce that the switch-case is exhaustive.
          modification satisfies never;
          throw new Error(`Invalid modification ${(modification as any).type}`);
        }
      }
    }
    this.version = transition.endVersion;
  }

  remoteQueryResults(): Map<QueryId, FunctionResult> {
    return this.remoteQuerySet;
  }

  timestamp(): Long {
    return this.version.ts;
  }
}
