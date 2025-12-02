import { list, fork, sort, range } from './array.mjs';
import { isArray, isPromise } from './typed.mjs';

const reduce = async (array, asyncReducer, initValue) => {
  const initProvided = initValue !== void 0;
  if (!initProvided && array?.length < 1) {
    throw new Error("Cannot reduce empty array with no init value");
  }
  const iter = initProvided ? array : array.slice(1);
  let value = initProvided ? initValue : array[0];
  for (const [i, item] of iter.entries()) {
    value = await asyncReducer(value, item, i);
  }
  return value;
};
const map = async (array, asyncMapFunc) => {
  if (!array)
    return [];
  let result = [];
  let index = 0;
  for (const value of array) {
    const newValue = await asyncMapFunc(value, index++);
    result.push(newValue);
  }
  return result;
};
const defer = async (func) => {
  const callbacks = [];
  const register = (fn, options) => callbacks.push({
    fn,
    rethrow: options?.rethrow ?? false
  });
  const [err, response] = await tryit(func)(register);
  for (const { fn, rethrow } of callbacks) {
    const [rethrown] = await tryit(fn)(err);
    if (rethrown && rethrow)
      throw rethrown;
  }
  if (err)
    throw err;
  return response;
};
class AggregateError extends Error {
  constructor(errors = []) {
    super();
    const name = errors.find((e) => e.name)?.name ?? "";
    this.name = `AggregateError(${name}...)`;
    this.message = `AggregateError with ${errors.length} errors`;
    this.stack = errors.find((e) => e.stack)?.stack ?? this.stack;
    this.errors = errors;
  }
}
const parallel = async (limit, array, func) => {
  const work = array.map((item, index) => ({
    index,
    item
  }));
  const processor = async (res) => {
    const results2 = [];
    while (true) {
      const next = work.pop();
      if (!next)
        return res(results2);
      const [error, result] = await tryit(func)(next.item);
      results2.push({
        error,
        result,
        index: next.index
      });
    }
  };
  const queues = list(1, limit).map(() => new Promise(processor));
  const itemResults = await Promise.all(queues);
  const [errors, results] = fork(
    sort(itemResults.flat(), (r) => r.index),
    (x) => !!x.error
  );
  if (errors.length > 0) {
    throw new AggregateError(errors.map((error) => error.error));
  }
  return results.map((r) => r.result);
};
async function all(promises) {
  const entries = isArray(promises) ? promises.map((p) => [null, p]) : Object.entries(promises);
  const results = await Promise.all(
    entries.map(
      ([key, value]) => value.then((result) => ({ result, exc: null, key })).catch((exc) => ({ result: null, exc, key }))
    )
  );
  const exceptions = results.filter((r) => r.exc);
  if (exceptions.length > 0) {
    throw new AggregateError(exceptions.map((e) => e.exc));
  }
  if (isArray(promises)) {
    return results.map((r) => r.result);
  }
  return results.reduce(
    (acc, item) => ({
      ...acc,
      [item.key]: item.result
    }),
    {}
  );
}
const retry = async (options, func) => {
  const times = options?.times ?? 3;
  const delay = options?.delay;
  const backoff = options?.backoff ?? null;
  for (const i of range(1, times)) {
    const [err, result] = await tryit(func)((err2) => {
      throw { _exited: err2 };
    });
    if (!err)
      return result;
    if (err._exited)
      throw err._exited;
    if (i === times)
      throw err;
    if (delay)
      await sleep(delay);
    if (backoff)
      await sleep(backoff(i));
  }
  return void 0;
};
const sleep = (milliseconds) => {
  return new Promise((res) => setTimeout(res, milliseconds));
};
const tryit = (func) => {
  return (...args) => {
    try {
      const result = func(...args);
      if (isPromise(result)) {
        return result.then((value) => [void 0, value]).catch((err) => [err, void 0]);
      }
      return [void 0, result];
    } catch (err) {
      return [err, void 0];
    }
  };
};
const guard = (func, shouldGuard) => {
  const _guard = (err) => {
    if (shouldGuard && !shouldGuard(err))
      throw err;
    return void 0;
  };
  const isPromise2 = (result) => result instanceof Promise;
  try {
    const result = func();
    return isPromise2(result) ? result.catch(_guard) : result;
  } catch (err) {
    return _guard(err);
  }
};

export { AggregateError, all, defer, guard, map, parallel, reduce, retry, sleep, tryit };
//# sourceMappingURL=async.mjs.map
