/** Each acquired resource has one owner. Every disposer runs even if another fails. */
export class Lifecycle {
  private readonly disposers: (() => void | Promise<void>)[] = [];
  private closing: Promise<void> | undefined;
  own(dispose: () => void | Promise<void>) {
    this.disposers.push(dispose);
  }
  close(): Promise<void> {
    return (this.closing ??= (async () => {
      const errors: unknown[] = [];
      for (const dispose of this.disposers.splice(0).reverse()) {
        try {
          await dispose();
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length) throw new AggregateError(errors, 'Application cleanup failed.');
    })());
  }
  async fail(error: unknown): Promise<never> {
    try {
      await this.close();
    } catch (cleanup) {
      throw new AggregateError([error, cleanup], 'Application startup failed; cleanup also failed.', { cause: error });
    }
    throw error;
  }
}

/** Release application resources when the serving process exits. */
export function registerApplicationShutdown(close: () => Promise<void>) {
  process.once('beforeExit', () => {
    void close().catch(error => {
      console.error('Application cleanup failed.', error);
      process.exitCode = 1;
    });
  });
  for (const signal of ['SIGTERM', 'SIGINT'] as const)
    process.once(signal, () => {
      void close().then(
        () => process.exit(0),
        error => {
          console.error('Application cleanup failed.', error);
          process.exit(1);
        },
      );
    });
}
