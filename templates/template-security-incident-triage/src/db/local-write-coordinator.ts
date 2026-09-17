// Operational transactions and Mastra snapshots/traces share this queue.
// SQLite still arbitrates between processes; never block the JS event loop
// waiting for a transaction in this same process to commit.
const localWriteTails = new Map<string, Promise<void>>();

export async function acquireLocalWrite(key: string): Promise<() => void> {
  const previous = localWriteTails.get(key) ?? Promise.resolve();
  let releaseTurn = () => {};
  const turn = new Promise<void>(resolve => {
    releaseTurn = resolve;
  });
  const tail = previous.then(() => turn);
  localWriteTails.set(key, tail);
  await previous;
  return () => {
    releaseTurn();
    void tail.then(() => {
      if (localWriteTails.get(key) === tail) localWriteTails.delete(key);
    });
  };
}
