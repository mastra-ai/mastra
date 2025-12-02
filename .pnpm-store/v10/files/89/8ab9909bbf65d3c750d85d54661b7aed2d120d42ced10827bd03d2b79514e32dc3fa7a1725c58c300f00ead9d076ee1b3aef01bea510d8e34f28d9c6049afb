"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { convexToJson } from "../../values/index.js";
import {
  canonicalizeUdfPath,
  serializePathAndArgs
} from "./udf_path_utils.js";
export class LocalSyncState {
  constructor() {
    __publicField(this, "nextQueryId");
    __publicField(this, "querySetVersion");
    __publicField(this, "querySet");
    __publicField(this, "queryIdToToken");
    __publicField(this, "identityVersion");
    __publicField(this, "auth");
    __publicField(this, "outstandingQueriesOlderThanRestart");
    __publicField(this, "outstandingAuthOlderThanRestart");
    __publicField(this, "paused");
    __publicField(this, "pendingQuerySetModifications");
    this.nextQueryId = 0;
    this.querySetVersion = 0;
    this.identityVersion = 0;
    this.querySet = /* @__PURE__ */ new Map();
    this.queryIdToToken = /* @__PURE__ */ new Map();
    this.outstandingQueriesOlderThanRestart = /* @__PURE__ */ new Set();
    this.outstandingAuthOlderThanRestart = false;
    this.paused = false;
    this.pendingQuerySetModifications = /* @__PURE__ */ new Map();
  }
  hasSyncedPastLastReconnect() {
    return this.outstandingQueriesOlderThanRestart.size === 0 && !this.outstandingAuthOlderThanRestart;
  }
  markAuthCompletion() {
    this.outstandingAuthOlderThanRestart = false;
  }
  subscribe(udfPath, args, journal, componentPath) {
    const canonicalizedUdfPath = canonicalizeUdfPath(udfPath);
    const queryToken = serializePathAndArgs(canonicalizedUdfPath, args);
    const existingEntry = this.querySet.get(queryToken);
    if (existingEntry !== void 0) {
      existingEntry.numSubscribers += 1;
      return {
        queryToken,
        modification: null,
        unsubscribe: () => this.removeSubscriber(queryToken)
      };
    } else {
      const queryId = this.nextQueryId++;
      const query = {
        id: queryId,
        canonicalizedUdfPath,
        args,
        numSubscribers: 1,
        journal,
        componentPath
      };
      this.querySet.set(queryToken, query);
      this.queryIdToToken.set(queryId, queryToken);
      const baseVersion = this.querySetVersion;
      const newVersion = this.querySetVersion + 1;
      const add = {
        type: "Add",
        queryId,
        udfPath: canonicalizedUdfPath,
        args: [convexToJson(args)],
        journal,
        componentPath
      };
      if (this.paused) {
        this.pendingQuerySetModifications.set(queryId, add);
      } else {
        this.querySetVersion = newVersion;
      }
      const modification = {
        type: "ModifyQuerySet",
        baseVersion,
        newVersion,
        modifications: [add]
      };
      return {
        queryToken,
        modification,
        unsubscribe: () => this.removeSubscriber(queryToken)
      };
    }
  }
  transition(transition) {
    for (const modification of transition.modifications) {
      switch (modification.type) {
        case "QueryUpdated":
        case "QueryFailed": {
          this.outstandingQueriesOlderThanRestart.delete(modification.queryId);
          const journal = modification.journal;
          if (journal !== void 0) {
            const queryToken = this.queryIdToToken.get(modification.queryId);
            if (queryToken !== void 0) {
              this.querySet.get(queryToken).journal = journal;
            }
          }
          break;
        }
        case "QueryRemoved": {
          this.outstandingQueriesOlderThanRestart.delete(modification.queryId);
          break;
        }
        default: {
          modification;
          throw new Error(`Invalid modification ${modification.type}`);
        }
      }
    }
  }
  queryId(udfPath, args) {
    const canonicalizedUdfPath = canonicalizeUdfPath(udfPath);
    const queryToken = serializePathAndArgs(canonicalizedUdfPath, args);
    const existingEntry = this.querySet.get(queryToken);
    if (existingEntry !== void 0) {
      return existingEntry.id;
    }
    return null;
  }
  isCurrentOrNewerAuthVersion(version) {
    return version >= this.identityVersion;
  }
  getAuth() {
    return this.auth;
  }
  setAuth(value) {
    this.auth = {
      tokenType: "User",
      value
    };
    const baseVersion = this.identityVersion;
    if (!this.paused) {
      this.identityVersion = baseVersion + 1;
    }
    return {
      type: "Authenticate",
      baseVersion,
      ...this.auth
    };
  }
  setAdminAuth(value, actingAs) {
    const auth = {
      tokenType: "Admin",
      value,
      impersonating: actingAs
    };
    this.auth = auth;
    const baseVersion = this.identityVersion;
    if (!this.paused) {
      this.identityVersion = baseVersion + 1;
    }
    return {
      type: "Authenticate",
      baseVersion,
      ...auth
    };
  }
  clearAuth() {
    this.auth = void 0;
    this.markAuthCompletion();
    const baseVersion = this.identityVersion;
    if (!this.paused) {
      this.identityVersion = baseVersion + 1;
    }
    return {
      type: "Authenticate",
      tokenType: "None",
      baseVersion
    };
  }
  hasAuth() {
    return !!this.auth;
  }
  isNewAuth(value) {
    return this.auth?.value !== value;
  }
  queryPath(queryId) {
    const pathAndArgs = this.queryIdToToken.get(queryId);
    if (pathAndArgs) {
      return this.querySet.get(pathAndArgs).canonicalizedUdfPath;
    }
    return null;
  }
  queryArgs(queryId) {
    const pathAndArgs = this.queryIdToToken.get(queryId);
    if (pathAndArgs) {
      return this.querySet.get(pathAndArgs).args;
    }
    return null;
  }
  queryToken(queryId) {
    return this.queryIdToToken.get(queryId) ?? null;
  }
  queryJournal(queryToken) {
    return this.querySet.get(queryToken)?.journal;
  }
  restart(oldRemoteQueryResults) {
    this.unpause();
    this.outstandingQueriesOlderThanRestart.clear();
    const modifications = [];
    for (const localQuery of this.querySet.values()) {
      const add = {
        type: "Add",
        queryId: localQuery.id,
        udfPath: localQuery.canonicalizedUdfPath,
        args: [convexToJson(localQuery.args)],
        journal: localQuery.journal,
        componentPath: localQuery.componentPath
      };
      modifications.push(add);
      if (!oldRemoteQueryResults.has(localQuery.id)) {
        this.outstandingQueriesOlderThanRestart.add(localQuery.id);
      }
    }
    this.querySetVersion = 1;
    const querySet = {
      type: "ModifyQuerySet",
      baseVersion: 0,
      newVersion: 1,
      modifications
    };
    if (!this.auth) {
      this.identityVersion = 0;
      return [querySet, void 0];
    }
    this.outstandingAuthOlderThanRestart = true;
    const authenticate = {
      type: "Authenticate",
      baseVersion: 0,
      ...this.auth
    };
    this.identityVersion = 1;
    return [querySet, authenticate];
  }
  pause() {
    this.paused = true;
  }
  resume() {
    const querySet = this.pendingQuerySetModifications.size > 0 ? {
      type: "ModifyQuerySet",
      baseVersion: this.querySetVersion,
      newVersion: ++this.querySetVersion,
      modifications: Array.from(
        this.pendingQuerySetModifications.values()
      )
    } : void 0;
    const authenticate = this.auth !== void 0 ? {
      type: "Authenticate",
      baseVersion: this.identityVersion++,
      ...this.auth
    } : void 0;
    this.unpause();
    return [querySet, authenticate];
  }
  unpause() {
    this.paused = false;
    this.pendingQuerySetModifications.clear();
  }
  removeSubscriber(queryToken) {
    const localQuery = this.querySet.get(queryToken);
    if (localQuery.numSubscribers > 1) {
      localQuery.numSubscribers -= 1;
      return null;
    } else {
      this.querySet.delete(queryToken);
      this.queryIdToToken.delete(localQuery.id);
      this.outstandingQueriesOlderThanRestart.delete(localQuery.id);
      const baseVersion = this.querySetVersion;
      const newVersion = this.querySetVersion + 1;
      const remove = {
        type: "Remove",
        queryId: localQuery.id
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
        modifications: [remove]
      };
    }
  }
}
//# sourceMappingURL=local_state.js.map
