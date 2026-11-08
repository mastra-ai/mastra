import { ComputersStorage } from './base';
import type { StoredComputerRecord } from './base';

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class InMemoryComputersStorage extends ComputersStorage {
  readonly #records = new Map<string, StoredComputerRecord>();

  async init(): Promise<void> {}

  async getComputer(id: string): Promise<StoredComputerRecord | undefined> {
    const record = this.#records.get(id);
    return record ? clone(record) : undefined;
  }

  async setComputer(record: StoredComputerRecord): Promise<void> {
    this.#records.set(record.id, clone(record));
  }

  async deleteComputer(id: string): Promise<void> {
    this.#records.delete(id);
  }

  async listComputers(resourceId: string): Promise<StoredComputerRecord[]> {
    return [...this.#records.values()].filter(record => record.ownerResourceId === resourceId).map(clone);
  }

  async dangerouslyClearAll(): Promise<void> {
    this.#records.clear();
  }
}
