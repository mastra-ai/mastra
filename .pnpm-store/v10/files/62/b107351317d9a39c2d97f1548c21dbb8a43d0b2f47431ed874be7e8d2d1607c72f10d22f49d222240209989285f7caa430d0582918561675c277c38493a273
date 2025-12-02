import { convexToJson, Value } from "../../values/index.js";
import {
  AddQuery,
  RemoveQuery,
  QueryId,
  QuerySetModification,
  QuerySetVersion,
  IdentityVersion,
  Authenticate,
  QueryJournal,
  Transition,
  AdminAuthentication,
  UserIdentityAttributes,
} from "./protocol.js";
import {
  canonicalizeUdfPath,
  QueryToken,
  serializePathAndArgs,
} from "./udf_path_utils.js";

type LocalQuery = {
  id: QueryId;
  canonicalizedUdfPath: string;
  args: Record<string, Value>;
  numSubscribers: number;
  journal?: QueryJournal | undefined;
  componentPath?: string | undefined;
};

export type AuthState =
  | {
      tokenType: "User";
      value: string;
    }
  | {
      tokenType: "Admin";
      value: string;
      impersonating?: UserIdentityAttributes | undefined;
    };

export class LocalSyncState {
  private nextQueryId: QueryId;
  private querySetVersion: QuerySetVersion;
  private readonly querySet: Map<QueryToken, LocalQuery>;
  private readonly queryIdToToken: Map<QueryId, QueryToken>;
  private identityVersion: IdentityVersion;
  private auth: AuthState | undefined;
  private readonly outstandingQueriesOlderThanRestart: Set<QueryId>;
  private outstandingAuthOlderThanRestart: boolean;
  private paused: boolean;
  private pendingQuerySetModifications: Map<QueryId, AddQuery | RemoveQuery>;

  constructor() {
    this.nextQueryId = 0;
    this.querySetVersion = 0;
    this.identityVersion = 0;
    this.querySet = new Map();
    this.queryIdToToken = new Map();
    this.outstandingQueriesOlderThanRestart = new Set();
    this.outstandingAuthOlderThanRestart = false;
    this.paused = false;
    this.pendingQuerySetModifications = new Map();
  }

  hasSyncedPastLastReconnect(): boolean {
    return (
      this.outstandingQueriesOlderThanRestart.size === 0 &&
      !this.outstandingAuthOlderThanRestart
    );
  }

  markAuthCompletion() {
    this.outstandingAuthOlderThanRestart = false;
  }

  subscribe(
    udfPath: string,
    args: Record<string, Value>,
    journal?: QueryJournal | undefined,
    componentPath?: string | undefined,
  ): {
    queryToken: QueryToken;
    modification: QuerySetModification | null;
    unsubscribe: () => QuerySetModification | null;
  } {
    const canonicalizedUdfPath = canonicalizeUdfPath(udfPath);
    const queryToken = serializePathAndArgs(canonicalizedUdfPath, args);

    const existingEntry = this.querySet.get(queryToken);

    if (existingEntry !== undefined) {
      existingEntry.numSubscribers += 1;
      return {
        queryToken,
        modification: null,
        unsubscribe: () => this.removeSubscriber(queryToken),
      };
    } else {
      const queryId = this.nextQueryId++;
      const query: LocalQuery = {
        id: queryId,
        canonicalizedUdfPath,
        args,
        numSubscribers: 1,
        journal,
        componentPath,
      };
      this.querySet.set(queryToken, query);
      this.queryIdToToken.set(queryId, queryToken);

      const baseVersion = this.querySetVersion;
      const newVersion = this.querySetVersion + 1;

      const add: AddQuery = {
        type: "Add",
        queryId,
        udfPath: canonicalizedUdfPath,
        args: [convexToJson(args)],
        journal,
        componentPath,
      };

      if (this.paused) {
        this.pendingQuerySetModifications.set(queryId, add);
      } else {
        this.querySetVersion = newVersion;
      }

      const modification: QuerySetModification = {
        type: "ModifyQuerySet",
        baseVersion,
        newVersion,
        modifications: [add],
      };
      return {
        queryToken,
        modification,
        unsubscribe: () => this.removeSubscriber(queryToken),
      };
    }
  }

  transition(transition: Transition) {
    for (const modification of transition.modifications) {
      switch (modification.type) {
        case "QueryUpdated":
        case "QueryFailed": {
          this.outstandingQueriesOlderThanRestart.delete(modification.queryId);
          const journal = modification.journal;
          if (journal !== undefined) {
            const queryToken = this.queryIdToToken.get(modification.queryId);
            // We may have already unsubscribed to this query by the time the server
            // sends us the journal. If so, just ignore it.
            if (queryToken !== undefined) {
              this.querySet.get(queryToken)!.journal = journal;
            }
          }

          break;
        }
        case "QueryRemoved": {
          this.outstandingQueriesOlderThanRestart.delete(modification.queryId);
          break;
        }
        default: {
          // Enforce that the switch-case is exhaustive.
          modification satisfies never;
          throw new Error(`Invalid modification ${(modification as any).type}`);
        }
      }
    }
  }

  queryId(udfPath: string, args: Record<string, Value>): QueryId | null {
    const canonicalizedUdfPath = canonicalizeUdfPath(udfPath);
    const queryToken = serializePathAndArgs(canonicalizedUdfPath, args);
    const existingEntry = this.querySet.get(queryToken);
    if (existingEntry !== undefined) {
      return existingEntry.id;
    }
    return null;
  }

  isCurrentOrNewerAuthVersion(version: IdentityVersion): boolean {
    return version >= this.identityVersion;
  }

  getAuth(): AuthState | undefined {
    return this.auth;
  }

  setAuth(value: string): Authenticate {
    this.auth = {
      tokenType: "User" as const,
      value: value,
    };
    const baseVersion = this.identityVersion;
    if (!this.paused) {
      this.identityVersion = baseVersion + 1;
    }
    return {
      type: "Authenticate",
      baseVersion: baseVersion,
      ...this.auth,
    };
  }

  setAdminAuth(
    value: string,
    actingAs?: UserIdentityAttributes,
  ): AdminAuthentication {
    const auth: typeof this.auth & {
      tokenType: "Admin";
    } = {
      tokenType: "Admin",
      value,
      impersonating: actingAs,
    };
    this.auth = auth;
    const baseVersion = this.identityVersion;
    if (!this.paused) {
      this.identityVersion = baseVersion + 1;
    }
    return {
      type: "Authenticate",
      baseVersion: baseVersion,
      ...auth,
    };
  }

  clearAuth(): Authenticate {
    this.auth = undefined;
    this.markAuthCompletion();
    const baseVersion = this.identityVersion;
    if (!this.paused) {
      this.identityVersion = baseVersion + 1;
    }
    return {
      type: "Authenticate",
      tokenType: "None",
      baseVersion: baseVersion,
    };
  }

  hasAuth(): boolean {
    return !!this.auth;
  }

  isNewAuth(value: string): boolean {
    return this.auth?.value !== value;
  }

  queryPath(queryId: QueryId): string | null {
    const pathAndArgs = this.queryIdToToken.get(queryId);
    if (pathAndArgs) {
      return this.querySet.get(pathAndArgs)!.canonicalizedUdfPath;
    }
    return null;
  }

  queryArgs(queryId: QueryId): Record<string, Value> | null {
    const pathAndArgs = this.queryIdToToken.get(queryId);
    if (pathAndArgs) {
      return this.querySet.get(pathAndArgs)!.args;
    }
    return null;
  }

  queryToken(queryId: QueryId): string | null {
    return this.queryIdToToken.get(queryId) ?? null;
  }

  queryJournal(queryToken: QueryToken): QueryJournal | undefined {
    return this.querySet.get(queryToken)?.journal;
  }

  restart(
    oldRemoteQueryResults: Set<QueryId>,
  ): [QuerySetModification, (Authenticate | undefined)?] {
    // Restart works whether we are paused or unpaused.
    // The `this.pendingQuerySetModifications` is not used
    // when restarting as the AddQuery and RemoveQuery are computed
    // from scratch, based on the old remote query results, here.
    this.unpause();

    this.outstandingQueriesOlderThanRestart.clear();
    const modifications = [];
    for (const localQuery of this.querySet.values()) {
      const add: AddQuery = {
        type: "Add",
        queryId: localQuery.id,
        udfPath: localQuery.canonicalizedUdfPath,
        args: [convexToJson(localQuery.args)],
        journal: localQuery.journal,
        componentPath: localQuery.componentPath,
      };
      modifications.push(add);

      if (!oldRemoteQueryResults.has(localQuery.id)) {
        this.outstandingQueriesOlderThanRestart.add(localQuery.id);
      }
    }
    this.querySetVersion = 1;
    const querySet: QuerySetModification = {
      type: "ModifyQuerySet",
      baseVersion: 0,
      newVersion: 1,
      modifications,
    };
    // If there's no auth, no need to send an update as the server will also start with an unknown identity.
    if (!this.auth) {
      this.identityVersion = 0;
      return [querySet, undefined];
    }
    this.outstandingAuthOlderThanRestart = true;
    const authenticate: Authenticate = {
      type: "Authenticate",
      baseVersion: 0,
      ...this.auth,
    };
    this.identityVersion = 1;
    return [querySet, authenticate];
  }

  pause() {
    this.paused = true;
  }

  resume(): [QuerySetModification | undefined, Authenticate | undefined] {
    const querySet: QuerySetModification | undefined =
      this.pendingQuerySetModifications.size > 0
        ? {
            type: "ModifyQuerySet",
            baseVersion: this.querySetVersion,
            newVersion: ++this.querySetVersion,
            modifications: Array.from(
              this.pendingQuerySetModifications.values(),
            ),
          }
        : undefined;
    const authenticate: Authenticate | undefined =
      this.auth !== undefined
        ? {
            type: "Authenticate",
            baseVersion: this.identityVersion++,
            ...this.auth,
          }
        : undefined;

    this.unpause();

    return [querySet, authenticate];
  }

  private unpause() {
    this.paused = false;
    this.pendingQuerySetModifications.clear();
  }

  private removeSubscriber(
    queryToken: QueryToken,
  ): QuerySetModification | null {
    const localQuery = this.querySet.get(queryToken)!;

    if (localQuery.numSubscribers > 1) {
      localQuery.numSubscribers -= 1;
      return null;
    } else {
      this.querySet.delete(queryToken);
      this.queryIdToToken.delete(localQuery.id);
      this.outstandingQueriesOlderThanRestart.delete(localQuery.id);
      const baseVersion = this.querySetVersion;
      const newVersion = this.querySetVersion + 1;
      const remove: RemoveQuery = {
        type: "Remove",
        queryId: localQuery.id,
      };
      if (this.paused) {
        if (this.pendingQuerySetModifications.has(localQuery.id)) {
          this.pendingQuerySetModifications.delete(localQuery.id);
        } else {
          this.pendingQuerySetModifications.set(localQuery.id, remove);
        }
      } else {
        this.querySetVersion = newVersion;
      }
      return {
        type: "ModifyQuerySet",
        baseVersion,
        newVersion,
        modifications: [remove],
      };
    }
  }
}
