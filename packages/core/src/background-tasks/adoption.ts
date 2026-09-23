import type { BackgroundTaskAdoptionContext, BackgroundTaskOperation } from './types';

type ExecuteAdoptedBackgroundOperationOptions<T> = {
  taskId: string;
  disposition: 'deferred' | 'awaited';
  abortSignal?: AbortSignal;
  execute: (background: BackgroundTaskAdoptionContext) => Promise<T>;
  onCancelError?: (error: unknown) => void;
};

export async function executeAdoptedBackgroundOperation<T>({
  taskId,
  disposition,
  abortSignal,
  execute,
  onCancelError,
}: ExecuteAdoptedBackgroundOperationOptions<T>): Promise<{ result: unknown; adopted: boolean }> {
  let adoptedOperation: BackgroundTaskOperation<unknown> | undefined;
  let adoptedCancellation: Promise<void> | undefined;
  let removeAbortListener: (() => void) | undefined;
  let acceptingAdoption = true;
  let executionCompleted = false;

  const cancelAdoptedOperation = (reason?: unknown): Promise<void> => {
    const cancel = adoptedOperation?.cancel;
    if (!cancel) return Promise.resolve();

    return (adoptedCancellation ??= Promise.resolve()
      .then(() => cancel(reason))
      .catch(error => {
        onCancelError?.(error);
      }));
  };

  try {
    const executeResult = await execute({
      taskId,
      disposition,
      adopt(operation) {
        if (!acceptingAdoption) {
          throw new Error('A background operation must be adopted before the tool returns');
        }
        if (adoptedOperation) {
          throw new Error('A background tool may adopt only one operation');
        }

        const completion = Promise.resolve(operation.completion);
        void completion.catch(() => {});
        adoptedOperation = { ...operation, completion };

        if (abortSignal && operation.cancel) {
          const onAbort = () => {
            void cancelAdoptedOperation(abortSignal.reason);
          };
          abortSignal.addEventListener('abort', onAbort, { once: true });
          removeAbortListener = () => abortSignal.removeEventListener('abort', onAbort);
          if (abortSignal.aborted) onAbort();
        }
      },
    });
    acceptingAdoption = false;
    executionCompleted = true;

    if (!adoptedOperation) {
      return { result: executeResult, adopted: false };
    }

    return { result: await adoptedOperation.completion, adopted: true };
  } catch (error) {
    if (adoptedOperation && !executionCompleted) {
      await cancelAdoptedOperation(error);
    }
    throw error;
  } finally {
    acceptingAdoption = false;
    removeAbortListener?.();
  }
}
