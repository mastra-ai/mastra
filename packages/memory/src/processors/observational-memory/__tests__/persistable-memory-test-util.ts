import { existsSync } from 'node:fs';
import { writeFile, readFile } from 'node:fs/promises';

import { InMemoryDB, InMemoryMemory, MastraCompositeStore } from '@mastra/core/storage';

type PersistableRecordTuple = [string, unknown];

type PersistedInMemoryState = {
  threads: PersistableRecordTuple[];
  resources: PersistableRecordTuple[];
  messages: PersistableRecordTuple[];
  observationalMemory: PersistableRecordTuple[];
};

function reviveDateValue(value: unknown): unknown {
  if (value && typeof value === 'object' && typeof (value as { __mastraDate?: string }).__mastraDate === 'string') {
    return new Date((value as { __mastraDate: string }).__mastraDate);
  }

  return value;
}

export class PersistableInMemoryMemory extends InMemoryMemory {
  private _db: InMemoryDB;
  private readOnly: boolean;

  constructor(args?: { db?: InMemoryDB; readOnly?: boolean }) {
    const db = args?.db ?? new InMemoryDB();

    super({ db });

    this._db = db;
    this.readOnly = args?.readOnly ?? false;
  }

  async persist(filePath: string): Promise<void> {
    if (this.readOnly) return;

    const state: PersistedInMemoryState = {
      threads: Array.from(this._db.threads.entries()),
      resources: Array.from(this._db.resources.entries()),
      messages: Array.from(this._db.messages.entries()),
      observationalMemory: Array.from(this._db.observationalMemory.entries()),
    };

    await writeFile(
      filePath,
      JSON.stringify(
        state,
        (_key, value) => {
          if (value instanceof Date) {
            return { __mastraDate: value.toISOString() };
          }

          return value;
        },
        2,
      ),
    );
  }

  async hydrate(filePath: string): Promise<void> {
    if (!existsSync(filePath)) {
      throw new Error(`Persisted OM memory state not found: ${filePath}`);
    }

    const content = await readFile(filePath, 'utf-8');
    const state = JSON.parse(content, (_key, value) => reviveDateValue(value)) as PersistedInMemoryState;

    this._db.threads.clear();
    this._db.resources.clear();
    this._db.messages.clear();
    this._db.observationalMemory.clear();

    for (const [key, thread] of state.threads ?? []) {
      this._db.threads.set(key, thread as any);
    }

    for (const [key, resource] of state.resources ?? []) {
      this._db.resources.set(key, resource as any);
    }

    for (const [key, message] of state.messages ?? []) {
      this._db.messages.set(key, message as any);
    }

    for (const [key, records] of state.observationalMemory ?? []) {
      this._db.observationalMemory.set(key, records as any);
    }
  }

  clear() {
    this._db.threads.clear();
    this._db.resources.clear();
    this._db.messages.clear();
    this._db.observationalMemory.clear();
  }

  getStats() {
    return {
      threads: this._db.threads.size,
      resources: this._db.resources.size,
      messages: this._db.messages.size,
      observations: this._db.observationalMemory.size,
    };
  }
}

export class PersistableInMemoryStore extends MastraCompositeStore {
  public readonly memory: PersistableInMemoryMemory;

  constructor({ id = 'persistable-test-memory-store', readOnly = false }: { id?: string; readOnly?: boolean } = {}) {
    const memory = new PersistableInMemoryMemory({ readOnly });

    super({
      id,
      domains: {
        memory,
      },
      name: 'PersistableInMemoryStore',
    });

    this.hasInitialized = Promise.resolve(true);
    this.memory = memory;
  }

  async persist(filePath: string) {
    await this.memory.persist(filePath);
  }

  async hydrate(filePath: string) {
    await this.memory.hydrate(filePath);
  }

  clear() {
    this.memory.clear();
  }
}
