import { QueryJournal } from "../browser/sync/protocol.js";
import { Watch } from "../react/client.js";
export default class FakeWatch<T> implements Watch<T> {
    callbacks: Set<() => void>;
    value: T | undefined;
    journalValue: QueryJournal | undefined;
    constructor();
    setValue(newValue: T | undefined): void;
    setJournal(journal: QueryJournal | undefined): void;
    numCallbacks(): number;
    onUpdate(callback: () => void): () => void;
    localQueryResult(): T | undefined;
    localQueryLogs(): string[] | undefined;
    journal(): QueryJournal | undefined;
}
//# sourceMappingURL=fake_watch.d.ts.map