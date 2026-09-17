import { randomUUID } from 'node:crypto';

export interface IdGenerator {
  next(): string;
}

export const uuidGenerator: IdGenerator = Object.freeze({ next: randomUUID });

export function sequenceIdGenerator(ids: readonly string[]): IdGenerator {
  let index = 0;
  return {
    next() {
      const id = ids[index];
      if (id === undefined) throw new Error('ID sequence exhausted');
      index += 1;
      return id;
    },
  };
}
