import { QueryJournal } from "../browser/sync/protocol.js";
import { Watch } from "../react/client.js";

export default class FakeWatch<T> implements Watch<T> {
  callbacks: Set<() => void>;
  value: T | undefined;
  journalValue: QueryJournal | undefined;

  constructor() {
    this.callbacks = new Set();
    this.value = undefined;
    this.journalValue = undefined;
  }

  setValue(newValue: T | undefined) {
    this.value = newValue;
    for (const callback of this.callbacks) {
      callback();
    }
  }

  setJournal(journal: QueryJournal | undefined) {
    this.journalValue = journal;
  }

  numCallbacks(): number {
    return this.callbacks.size;
  }

  onUpdate(callback: () => void) {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);

      // If no one is subscribed anymore, drop our journal like the real
      // client would.
      if (this.numCallbacks() === 0) {
        this.journalValue = undefined;
      }
    };
  }

  localQueryResult(): T | undefined {
    return this.value;
  }

  localQueryLogs(): string[] | undefined {
    return undefined;
  }

  journal(): QueryJournal | undefined {
    return this.journalValue;
  }
}
