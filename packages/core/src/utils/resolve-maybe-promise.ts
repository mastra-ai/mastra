export function resolveMaybePromise<T, R = void>(
  value: T | Promise<T> | PromiseLike<T>,
  cb: (value: T) => R,
): R | Promise<R> {
  if (value instanceof Promise || (value != null && typeof (value as PromiseLike<T>).then === 'function')) {
    return Promise.resolve(value).then(cb);
  }

  return cb(value as T);
}
