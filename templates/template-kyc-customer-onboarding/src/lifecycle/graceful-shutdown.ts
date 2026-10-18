export type ShutdownOperation = () => void | Promise<void>;

export type GracefulShutdownDependencies = Readonly<{
  stopServer: ShutdownOperation;
  forceStopServer: ShutdownOperation;
  drainObservability: ShutdownOperation;
  closeStorage: ShutdownOperation;
  operationTimeoutMs: number;
}>;

const withTimeout = async (operation: ShutdownOperation, timeoutMs: number, operationName: string): Promise<void> => {
  let timeout: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      Promise.resolve().then(operation),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error(`${operationName} timed out during graceful shutdown`)), timeoutMs);
        timeout.unref();
      }),
    ]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
};

export const drainMastraObservability = async (
  observability: Readonly<{ flush: () => Promise<void>; shutdown: () => Promise<void> }>,
): Promise<void> => {
  const errors: unknown[] = [];
  try {
    await observability.flush();
  } catch (error) {
    errors.push(error);
  }
  try {
    await observability.shutdown();
  } catch (error) {
    errors.push(error);
  }
  if (errors.length > 0) throw new AggregateError(errors, 'Failed to drain observability');
};

export const createGracefulShutdown = (dependencies: GracefulShutdownDependencies): (() => Promise<void>) => {
  let shutdownPromise: Promise<void> | undefined;

  return () => {
    shutdownPromise ??= (async () => {
      const errors: unknown[] = [];
      try {
        await withTimeout(dependencies.stopServer, dependencies.operationTimeoutMs, 'server stop');
      } catch (error) {
        errors.push(error);
        try {
          await withTimeout(dependencies.forceStopServer, dependencies.operationTimeoutMs, 'server force stop');
        } catch (forceStopError) {
          errors.push(forceStopError);
        }
      }
      try {
        await withTimeout(dependencies.drainObservability, dependencies.operationTimeoutMs, 'observability drain');
      } catch (error) {
        errors.push(error);
      }
      try {
        await dependencies.closeStorage();
      } catch (error) {
        errors.push(error);
      }
      if (errors.length > 0) throw new AggregateError(errors, 'Graceful shutdown failed');
    })();
    return shutdownPromise;
  };
};
