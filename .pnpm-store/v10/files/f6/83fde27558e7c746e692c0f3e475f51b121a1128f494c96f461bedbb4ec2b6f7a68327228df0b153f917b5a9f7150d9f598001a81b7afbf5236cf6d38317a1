import { convexToJson, Value } from "../values/index.js";
import { Watch } from "./client.js";
import { QueryJournal } from "../browser/sync/protocol.js";
import { FunctionReference, getFunctionName } from "../server/api.js";

type Identifier = string;

type QueryInfo = {
  query: FunctionReference<"query">;
  args: Record<string, Value>;
  watch: Watch<Value>;
  unsubscribe: () => void;
};

export type CreateWatch = (
  query: FunctionReference<"query">,
  args: Record<string, Value>,
  journal?: QueryJournal,
) => Watch<Value>;

/**
 * A class for observing the results of multiple queries at the same time.
 *
 * Any time the result of a query changes, the listeners are notified.
 */
export class QueriesObserver {
  public createWatch: CreateWatch;
  private queries: Record<Identifier, QueryInfo>;
  private listeners: Set<() => void>;

  constructor(createWatch: CreateWatch) {
    this.createWatch = createWatch;
    this.queries = {};
    this.listeners = new Set();
  }

  setQueries(
    newQueries: Record<
      Identifier,
      { query: FunctionReference<"query">; args: Record<string, Value> }
    >,
  ) {
    // Add the new queries before unsubscribing from the old ones so that
    // the deduping in the `ConvexReactClient` can help if there are duplicates.
    for (const identifier of Object.keys(newQueries)) {
      const { query, args } = newQueries[identifier];
      // Might throw
      getFunctionName(query);

      if (this.queries[identifier] === undefined) {
        // No existing query => add it.
        this.addQuery(identifier, query, args);
      } else {
        const existingInfo = this.queries[identifier];
        if (
          getFunctionName(query) !== getFunctionName(existingInfo.query) ||
          JSON.stringify(convexToJson(args)) !==
            JSON.stringify(convexToJson(existingInfo.args))
        ) {
          // Existing query that doesn't match => remove the old and add the new.
          this.removeQuery(identifier);
          this.addQuery(identifier, query, args);
        }
      }
    }

    // Prune all the existing queries that we no longer need.
    for (const identifier of Object.keys(this.queries)) {
      if (newQueries[identifier] === undefined) {
        this.removeQuery(identifier);
      }
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getLocalResults(
    queries: Record<
      Identifier,
      { query: FunctionReference<"query">; args: Record<string, Value> }
    >,
  ): Record<Identifier, Value | undefined | Error> {
    const result: Record<Identifier, Value | Error | undefined> = {};
    for (const identifier of Object.keys(queries)) {
      const { query, args } = queries[identifier];
      // Might throw
      getFunctionName(query);

      // Note: We're not gonna watch, we could save some allocations
      // by getting a reference to the client directly instead.
      const watch = this.createWatch(query, args);
      let value: Value | undefined | Error;
      try {
        value = watch.localQueryResult();
      } catch (e) {
        // Only collect instances of `Error` because thats how callers
        // will distinguish errors from normal results.
        if (e instanceof Error) {
          value = e;
        } else {
          throw e;
        }
      }
      result[identifier] = value;
    }
    return result;
  }

  setCreateWatch(createWatch: CreateWatch) {
    this.createWatch = createWatch;
    // If we have a new watch, we might be using a new Convex client.
    // Recreate all the watches being careful to preserve the journals.
    for (const identifier of Object.keys(this.queries)) {
      const { query, args, watch } = this.queries[identifier];
      const journal = watch.journal();
      this.removeQuery(identifier);
      this.addQuery(identifier, query, args, journal);
    }
  }

  destroy() {
    for (const identifier of Object.keys(this.queries)) {
      this.removeQuery(identifier);
    }
    this.listeners = new Set();
  }

  private addQuery(
    identifier: Identifier,
    query: FunctionReference<"query">,
    args: Record<string, Value>,
    journal?: QueryJournal,
  ) {
    if (this.queries[identifier] !== undefined) {
      throw new Error(
        `Tried to add a new query with identifier ${identifier} when it already exists.`,
      );
    }
    const watch = this.createWatch(query, args, journal);
    const unsubscribe = watch.onUpdate(() => this.notifyListeners());
    this.queries[identifier] = {
      query,
      args,
      watch,
      unsubscribe,
    };
  }

  private removeQuery(identifier: Identifier) {
    const info = this.queries[identifier];
    if (info === undefined) {
      throw new Error(`No query found with identifier ${identifier}.`);
    }
    info.unsubscribe();
    delete this.queries[identifier];
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
