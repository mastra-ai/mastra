declare const retryifyAsync: <FN extends Function>(fn: FN, isRetriableError: (error: unknown) => boolean | void) => (timeout: number) => FN;
declare const retryifySync: <FN extends Function>(fn: FN, isRetriableError: (error: unknown) => boolean | void) => (timeout: number) => FN;
export { retryifyAsync, retryifySync };
