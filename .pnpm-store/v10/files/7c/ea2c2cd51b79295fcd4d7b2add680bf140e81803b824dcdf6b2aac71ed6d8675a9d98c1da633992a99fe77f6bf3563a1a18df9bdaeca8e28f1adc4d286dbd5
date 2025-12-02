import { Value } from "../values/index.js";
import { Watch } from "./client.js";
import { QueryJournal } from "../browser/sync/protocol.js";
import { FunctionReference } from "../server/api.js";
type Identifier = string;
export type CreateWatch = (query: FunctionReference<"query">, args: Record<string, Value>, journal?: QueryJournal) => Watch<Value>;
/**
 * A class for observing the results of multiple queries at the same time.
 *
 * Any time the result of a query changes, the listeners are notified.
 */
export declare class QueriesObserver {
    createWatch: CreateWatch;
    private queries;
    private listeners;
    constructor(createWatch: CreateWatch);
    setQueries(newQueries: Record<Identifier, {
        query: FunctionReference<"query">;
        args: Record<string, Value>;
    }>): void;
    subscribe(listener: () => void): () => void;
    getLocalResults(queries: Record<Identifier, {
        query: FunctionReference<"query">;
        args: Record<string, Value>;
    }>): Record<Identifier, Value | undefined | Error>;
    setCreateWatch(createWatch: CreateWatch): void;
    destroy(): void;
    private addQuery;
    private removeQuery;
    private notifyListeners;
}
export {};
//# sourceMappingURL=queries_observer.d.ts.map