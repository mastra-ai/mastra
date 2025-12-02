/**
 * Sorts an array of items into groups. The return value is a map where the keys are
 * the group ids the given getGroupId function produced and the value is an array of
 * each item in that group.
 */
declare const group: <T, Key extends string | number | symbol>(array: readonly T[], getGroupId: (item: T) => Key) => Partial<Record<Key, T[]>>;
/**
 * Creates an array of grouped elements, the first of which contains the
 * first elements of the given arrays, the second of which contains the
 * second elements of the given arrays, and so on.
 *
 * Ex. const zipped = zip(['a', 'b'], [1, 2], [true, false]) // [['a', 1, true], ['b', 2, false]]
 */
declare function zip<T1, T2, T3, T4, T5>(array1: T1[], array2: T2[], array3: T3[], array4: T4[], array5: T5[]): [T1, T2, T3, T4, T5][];
declare function zip<T1, T2, T3, T4>(array1: T1[], array2: T2[], array3: T3[], array4: T4[]): [T1, T2, T3, T4][];
declare function zip<T1, T2, T3>(array1: T1[], array2: T2[], array3: T3[]): [T1, T2, T3][];
declare function zip<T1, T2>(array1: T1[], array2: T2[]): [T1, T2][];
/**
 * Creates an object mapping the specified keys to their corresponding values
 *
 * Ex. const zipped = zipToObject(['a', 'b'], [1, 2]) // { a: 1, b: 2 }
 * Ex. const zipped = zipToObject(['a', 'b'], (k, i) => k + i) // { a: 'a0', b: 'b1' }
 * Ex. const zipped = zipToObject(['a', 'b'], 1) // { a: 1, b: 1 }
 */
declare function zipToObject<K extends string | number | symbol, V>(keys: K[], values: V | ((key: K, idx: number) => V) | V[]): Record<K, V>;
/**
 * Go through a list of items, starting with the first item,
 * and comparing with the second. Keep the one you want then
 * compare that to the next item in the list with the same
 *
 * Ex. const greatest = () => boil(numbers, (a, b) => a > b)
 */
declare const boil: <T>(array: readonly T[], compareFunc: (a: T, b: T) => T) => T | null;
/**
 * Sum all numbers in an array. Optionally provide a function
 * to convert objects in the array to number values.
 */
declare function sum<T extends number>(array: readonly T[]): number;
declare function sum<T extends object>(array: readonly T[], fn: (item: T) => number): number;
/**
 * Get the first item in an array or a default value
 */
declare const first: <T>(array: readonly T[], defaultValue?: T | null | undefined) => T | null | undefined;
/**
 * Get the last item in an array or a default value
 */
declare const last: <T>(array: readonly T[], defaultValue?: T | null | undefined) => T | null | undefined;
/**
 * Sort an array without modifying it and return
 * the newly sorted value
 */
declare const sort: <T>(array: readonly T[], getter: (item: T) => number, desc?: boolean) => T[];
/**
 * Sort an array without modifying it and return
 * the newly sorted value. Allows for a string
 * sorting value.
 */
declare const alphabetical: <T>(array: readonly T[], getter: (item: T) => string, dir?: 'asc' | 'desc') => T[];
declare const counting: <T, TId extends string | number | symbol>(list: readonly T[], identity: (item: T) => TId) => Record<TId, number>;
/**
 * Replace an element in an array with a new
 * item without modifying the array and return
 * the new value
 */
declare const replace: <T>(list: readonly T[], newItem: T, match: (item: T, idx: number) => boolean) => T[];
/**
 * Convert an array to a dictionary by mapping each item
 * into a dictionary key & value
 */
declare const objectify: <T, Key extends string | number | symbol, Value = T>(array: readonly T[], getKey: (item: T) => Key, getValue?: (item: T) => Value) => Record<Key, Value>;
/**
 * Select performs a filter and a mapper inside of a reduce,
 * only iterating the list one time.
 *
 * @example
 * select([1, 2, 3, 4], x => x*x, x > 2) == [9, 16]
 */
declare const select: <T, K>(array: readonly T[], mapper: (item: T, index: number) => K, condition: (item: T, index: number) => boolean) => K[];
/**
 * Max gets the greatest value from a list
 *
 * @example
 * max([ 2, 3, 5]) == 5
 * max([{ num: 1 }, { num: 2 }], x => x.num) == { num: 2 }
 */
declare function max(array: readonly [number, ...number[]]): number;
declare function max(array: readonly number[]): number | null;
declare function max<T>(array: readonly T[], getter: (item: T) => number): T | null;
/**
 * Min gets the smallest value from a list
 *
 * @example
 * min([1, 2, 3, 4]) == 1
 * min([{ num: 1 }, { num: 2 }], x => x.num) == { num: 1 }
 */
declare function min(array: readonly [number, ...number[]]): number;
declare function min(array: readonly number[]): number | null;
declare function min<T>(array: readonly T[], getter: (item: T) => number): T | null;
/**
 * Splits a single list into many lists of the desired size. If
 * given a list of 10 items and a size of 2, it will return 5
 * lists with 2 items each
 */
declare const cluster: <T>(list: readonly T[], size?: number) => T[][];
/**
 * Given a list of items returns a new list with only
 * unique items. Accepts an optional identity function
 * to convert each item in the list to a comparable identity
 * value
 */
declare const unique: <T, K extends string | number | symbol>(array: readonly T[], toKey?: ((item: T) => K) | undefined) => T[];
/**
 * Creates a generator that will produce an iteration through
 * the range of number as requested.
 *
 * @example
 * range(3)                  // yields 0, 1, 2, 3
 * range(0, 3)               // yields 0, 1, 2, 3
 * range(0, 3, 'y')          // yields y, y, y, y
 * range(0, 3, () => 'y')    // yields y, y, y, y
 * range(0, 3, i => i)       // yields 0, 1, 2, 3
 * range(0, 3, i => `y${i}`) // yields y0, y1, y2, y3
 * range(0, 3, obj)          // yields obj, obj, obj, obj
 * range(0, 6, i => i, 2)    // yields 0, 2, 4, 6
 */
declare function range<T = number>(startOrLength: number, end?: number, valueOrMapper?: T | ((i: number) => T), step?: number): Generator<T>;
/**
 * Creates a list of given start, end, value, and
 * step parameters.
 *
 * @example
 * list(3)                  // 0, 1, 2, 3
 * list(0, 3)               // 0, 1, 2, 3
 * list(0, 3, 'y')          // y, y, y, y
 * list(0, 3, () => 'y')    // y, y, y, y
 * list(0, 3, i => i)       // 0, 1, 2, 3
 * list(0, 3, i => `y${i}`) // y0, y1, y2, y3
 * list(0, 3, obj)          // obj, obj, obj, obj
 * list(0, 6, i => i, 2)    // 0, 2, 4, 6
 */
declare const list: <T = number>(startOrLength: number, end?: number, valueOrMapper?: T | ((i: number) => T) | undefined, step?: number) => T[];
/**
 * Given an array of arrays, returns a single
 * dimentional array with all items in it.
 */
declare const flat: <T>(lists: readonly T[][]) => T[];
/**
 * Given two arrays, returns true if any
 * elements intersect
 */
declare const intersects: <T, K extends string | number | symbol>(listA: readonly T[], listB: readonly T[], identity?: ((t: T) => K) | undefined) => boolean;
/**
 * Split an array into two array based on
 * a true/false condition function
 */
declare const fork: <T>(list: readonly T[], condition: (item: T) => boolean) => [T[], T[]];
/**
 * Given two lists of the same type, iterate the first list
 * and replace items matched by the matcher func in the
 * first place.
 */
declare const merge: <T>(root: readonly T[], others: readonly T[], matcher: (item: T) => any) => readonly T[];
/**
 * Replace an item in an array by a match function condition. If
 * no items match the function condition, appends the new item to
 * the end of the list.
 */
declare const replaceOrAppend: <T>(list: readonly T[], newItem: T, match: (a: T, idx: number) => boolean) => T[];
/**
 * If the item matching the condition already exists
 * in the list it will be removed. If it does not it
 * will be added.
 */
declare const toggle: <T>(list: readonly T[], item: T, toKey?: ((item: T, idx: number) => number | string | symbol) | null | undefined, options?: {
    strategy?: 'prepend' | 'append';
}) => T[];
type Falsy = null | undefined | false | '' | 0 | 0n;
/**
 * Given a list returns a new list with
 * only truthy values
 */
declare const sift: <T>(list: readonly (Falsy | T)[]) => T[];
/**
 * Like a reduce but does not require an array.
 * Only need a number and will iterate the function
 * as many times as specified.
 *
 * NOTE: This is NOT zero indexed. If you pass count=5
 * you will get 1, 2, 3, 4, 5 iteration in the callback
 * function
 */
declare const iterate: <T>(count: number, func: (currentValue: T, iteration: number) => T, initValue: T) => T;
/**
 * Returns all items from the first list that
 * do not exist in the second list.
 */
declare const diff: <T>(root: readonly T[], other: readonly T[], identity?: (item: T) => string | number | symbol) => T[];
/**
 * Shift array items by n steps
 * If n > 0 items will shift n steps to the right
 * If n < 0 items will shift n steps to the left
 */
declare function shift<T>(arr: Array<T>, n: number): T[];

/**
 * An async reduce function. Works like the
 * built-in Array.reduce function but handles
 * an async reducer function
 */
declare const reduce: <T, K>(array: readonly T[], asyncReducer: (acc: K, item: T, index: number) => Promise<K>, initValue?: K | undefined) => Promise<K>;
/**
 * An async map function. Works like the
 * built-in Array.map function but handles
 * an async mapper function
 */
declare const map: <T, K>(array: readonly T[], asyncMapFunc: (item: T, index: number) => Promise<K>) => Promise<K[]>;
/**
 * Useful when for script like things where cleanup
 * should be done on fail or sucess no matter.
 *
 * You can call defer many times to register many
 * defered functions that will all be called when
 * the function exits in any state.
 */
declare const defer: <TResponse>(func: (register: (fn: (error?: any) => any, options?: {
    rethrow?: boolean;
}) => void) => Promise<TResponse>) => Promise<TResponse>;
/**
 * Support for the built-in AggregateError
 * is still new. Node < 15 doesn't have it
 * so patching here.
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AggregateError#browser_compatibility
 */
declare class AggregateError extends Error {
    errors: Error[];
    constructor(errors?: Error[]);
}
/**
 * Executes many async functions in parallel. Returns the
 * results from all functions as an array. After all functions
 * have resolved, if any errors were thrown, they are rethrown
 * in an instance of AggregateError
 */
declare const parallel: <T, K>(limit: number, array: readonly T[], func: (item: T) => Promise<K>) => Promise<K[]>;
type PromiseValues<T extends Promise<any>[]> = {
    [K in keyof T]: T[K] extends Promise<infer U> ? U : never;
};
/**
 * Functionally similar to Promise.all or Promise.allSettled. If any
 * errors are thrown, all errors are gathered and thrown in an
 * AggregateError.
 *
 * @example
 * const [user] = await all([
 *   api.users.create(...),
 *   s3.buckets.create(...),
 *   slack.customerSuccessChannel.sendMessage(...)
 * ])
 */
declare function all<T extends [Promise<any>, ...Promise<any>[]]>(promises: T): Promise<PromiseValues<T>>;
declare function all<T extends Promise<any>[]>(promises: T): Promise<PromiseValues<T>>;
/**
 * Functionally similar to Promise.all or Promise.allSettled. If any
 * errors are thrown, all errors are gathered and thrown in an
 * AggregateError.
 *
 * @example
 * const { user } = await all({
 *   user: api.users.create(...),
 *   bucket: s3.buckets.create(...),
 *   message: slack.customerSuccessChannel.sendMessage(...)
 * })
 */
declare function all<T extends Record<string, Promise<any>>>(promises: T): Promise<{
    [K in keyof T]: Awaited<T[K]>;
}>;
/**
 * Retries the given function the specified number
 * of times.
 */
declare const retry: <TResponse>(options: {
    times?: number | undefined;
    delay?: number | null | undefined;
    backoff?: ((count: number) => number) | undefined;
}, func: (exit: (err: any) => void) => Promise<TResponse>) => Promise<TResponse>;
/**
 * Async wait
 */
declare const sleep: (milliseconds: number) => Promise<unknown>;
/**
 * A helper to try an async function without forking
 * the control flow. Returns an error first callback _like_
 * array response as [Error, result]
 */
declare const tryit: <Args extends any[], Return>(func: (...args: Args) => Return) => (...args: Args) => Return extends Promise<any> ? Promise<[Error, undefined] | [undefined, Awaited<Return>]> : [Error, undefined] | [undefined, Return];
/**
 * A helper to try an async function that returns undefined
 * if it fails.
 *
 * e.g. const result = await guard(fetchUsers)() ?? [];
 */
declare const guard: <TFunction extends () => any>(func: TFunction, shouldGuard?: ((err: any) => boolean) | undefined) => ReturnType<TFunction> extends Promise<any> ? Promise<Awaited<ReturnType<TFunction>> | undefined> : ReturnType<TFunction> | undefined;

declare function chain<T1 extends any[], T2, T3>(f1: (...arg: T1) => T2, f2: (arg: T2) => T3): (...arg: T1) => T3;
declare function chain<T1 extends any[], T2, T3, T4>(f1: (...arg: T1) => T2, f2: (arg: T2) => T3, f3: (arg: T3) => T4): (...arg: T1) => T4;
declare function chain<T1 extends any[], T2, T3, T4, T5>(f1: (...arg: T1) => T2, f2: (arg: T2) => T3, f3: (arg: T3) => T4, f4: (arg: T3) => T5): (...arg: T1) => T5;
declare function chain<T1 extends any[], T2, T3, T4, T5, T6>(f1: (...arg: T1) => T2, f2: (arg: T2) => T3, f3: (arg: T3) => T4, f4: (arg: T3) => T5, f5: (arg: T3) => T6): (...arg: T1) => T6;
declare function chain<T1 extends any[], T2, T3, T4, T5, T6, T7>(f1: (...arg: T1) => T2, f2: (arg: T2) => T3, f3: (arg: T3) => T4, f4: (arg: T3) => T5, f5: (arg: T3) => T6, f6: (arg: T3) => T7): (...arg: T1) => T7;
declare function chain<T1 extends any[], T2, T3, T4, T5, T6, T7, T8>(f1: (...arg: T1) => T2, f2: (arg: T2) => T3, f3: (arg: T3) => T4, f4: (arg: T3) => T5, f5: (arg: T3) => T6, f6: (arg: T3) => T7, f7: (arg: T3) => T8): (...arg: T1) => T8;
declare function chain<T1 extends any[], T2, T3, T4, T5, T6, T7, T8, T9>(f1: (...arg: T1) => T2, f2: (arg: T2) => T3, f3: (arg: T3) => T4, f4: (arg: T3) => T5, f5: (arg: T3) => T6, f6: (arg: T3) => T7, f7: (arg: T3) => T8, f8: (arg: T3) => T9): (...arg: T1) => T9;
declare function chain<T1 extends any[], T2, T3, T4, T5, T6, T7, T8, T9, T10>(f1: (...arg: T1) => T2, f2: (arg: T2) => T3, f3: (arg: T3) => T4, f4: (arg: T3) => T5, f5: (arg: T3) => T6, f6: (arg: T3) => T7, f7: (arg: T3) => T8, f8: (arg: T3) => T9, f9: (arg: T3) => T10): (...arg: T1) => T10;
declare function chain<T1 extends any[], T2, T3, T4, T5, T6, T7, T8, T9, T10, T11>(f1: (...arg: T1) => T2, f2: (arg: T2) => T3, f3: (arg: T3) => T4, f4: (arg: T3) => T5, f5: (arg: T3) => T6, f6: (arg: T3) => T7, f7: (arg: T3) => T8, f8: (arg: T3) => T9, f9: (arg: T3) => T10, f10: (arg: T3) => T11): (...arg: T1) => T11;
declare function compose<F1Result, F1Args extends any[], F1NextArgs extends any[], LastResult>(f1: (next: (...args: F1NextArgs) => LastResult) => (...args: F1Args) => F1Result, last: (...args: F1NextArgs) => LastResult): (...args: F1Args) => F1Result;
declare function compose<F1Result, F1Args extends any[], F1NextArgs extends any[], F2Result, F2NextArgs extends any[], LastResult>(f1: (next: (...args: F1NextArgs) => F2Result) => (...args: F1Args) => F1Result, f2: (next: (...args: F2NextArgs) => LastResult) => (...args: F1NextArgs) => F2Result, last: (...args: F2NextArgs) => LastResult): (...args: F1Args) => F1Result;
declare function compose<F1Result, F1Args extends any[], F1NextArgs extends any[], F2NextArgs extends any[], F2Result, F3NextArgs extends any[], F3Result, LastResult>(f1: (next: (...args: F1NextArgs) => F2Result) => (...args: F1Args) => F1Result, f2: (next: (...args: F2NextArgs) => F3Result) => (...args: F1NextArgs) => F2Result, f3: (next: (...args: F3NextArgs) => LastResult) => (...args: F2NextArgs) => F3Result, last: (...args: F3NextArgs) => LastResult): (...args: F1Args) => F1Result;
declare function compose<F1Result, F1Args extends any[], F1NextArgs extends any[], F2NextArgs extends any[], F2Result, F3NextArgs extends any[], F3Result, F4NextArgs extends any[], F4Result, LastResult>(f1: (next: (...args: F1NextArgs) => F2Result) => (...args: F1Args) => F1Result, f2: (next: (...args: F2NextArgs) => F3Result) => (...args: F1NextArgs) => F2Result, f3: (next: (...args: F3NextArgs) => F4Result) => (...args: F2NextArgs) => F3Result, f4: (next: (...args: F4NextArgs) => LastResult) => (...args: F3NextArgs) => F4Result, last: (...args: F4NextArgs) => LastResult): (...args: F1Args) => F1Result;
declare function compose<F1Result, F1Args extends any[], F1NextArgs extends any[], F2NextArgs extends any[], F2Result, F3NextArgs extends any[], F3Result, F4NextArgs extends any[], F4Result, F5NextArgs extends any[], F5Result, LastResult>(f1: (next: (...args: F1NextArgs) => F2Result) => (...args: F1Args) => F1Result, f2: (next: (...args: F2NextArgs) => F3Result) => (...args: F1NextArgs) => F2Result, f3: (next: (...args: F3NextArgs) => F4Result) => (...args: F2NextArgs) => F3Result, f4: (next: (...args: F4NextArgs) => F5Result) => (...args: F3NextArgs) => F4Result, f5: (next: (...args: F5NextArgs) => LastResult) => (...args: F4NextArgs) => F5Result, last: (...args: F5NextArgs) => LastResult): (...args: F1Args) => F1Result;
declare function compose<F1Result, F1Args extends any[], F1NextArgs extends any[], F2NextArgs extends any[], F2Result, F3NextArgs extends any[], F3Result, F4NextArgs extends any[], F4Result, F5NextArgs extends any[], F5Result, F6NextArgs extends any[], F6Result, LastResult>(f1: (next: (...args: F1NextArgs) => F2Result) => (...args: F1Args) => F1Result, f2: (next: (...args: F2NextArgs) => F3Result) => (...args: F1NextArgs) => F2Result, f3: (next: (...args: F3NextArgs) => F4Result) => (...args: F2NextArgs) => F3Result, f4: (next: (...args: F4NextArgs) => F5Result) => (...args: F3NextArgs) => F4Result, f5: (next: (...args: F5NextArgs) => F6Result) => (...args: F4NextArgs) => F5Result, f6: (next: (...args: F6NextArgs) => LastResult) => (...args: F5NextArgs) => F6Result, last: (...args: F6NextArgs) => LastResult): (...args: F1Args) => F1Result;
declare function compose<F1Result, F1Args extends any[], F1NextArgs extends any[], F2NextArgs extends any[], F2Result, F3NextArgs extends any[], F3Result, F4NextArgs extends any[], F4Result, F5NextArgs extends any[], F5Result, F6NextArgs extends any[], F6Result, F7NextArgs extends any[], F7Result, LastResult>(f1: (next: (...args: F1NextArgs) => F2Result) => (...args: F1Args) => F1Result, f2: (next: (...args: F2NextArgs) => F3Result) => (...args: F1NextArgs) => F2Result, f3: (next: (...args: F3NextArgs) => F4Result) => (...args: F2NextArgs) => F3Result, f4: (next: (...args: F4NextArgs) => F5Result) => (...args: F3NextArgs) => F4Result, f5: (next: (...args: F5NextArgs) => F6Result) => (...args: F4NextArgs) => F5Result, f6: (next: (...args: F6NextArgs) => F7Result) => (...args: F5NextArgs) => F6Result, f7: (next: (...args: F7NextArgs) => LastResult) => (...args: F6NextArgs) => F7Result, last: (...args: F7NextArgs) => LastResult): (...args: F1Args) => F1Result;
declare function compose<F1Result, F1Args extends any[], F1NextArgs extends any[], F2NextArgs extends any[], F2Result, F3NextArgs extends any[], F3Result, F4NextArgs extends any[], F4Result, F5NextArgs extends any[], F5Result, F6NextArgs extends any[], F6Result, F7NextArgs extends any[], F7Result, F8NextArgs extends any[], F8Result, LastResult>(f1: (next: (...args: F1NextArgs) => F2Result) => (...args: F1Args) => F1Result, f2: (next: (...args: F2NextArgs) => F3Result) => (...args: F1NextArgs) => F2Result, f3: (next: (...args: F3NextArgs) => F4Result) => (...args: F2NextArgs) => F3Result, f4: (next: (...args: F4NextArgs) => F5Result) => (...args: F3NextArgs) => F4Result, f5: (next: (...args: F5NextArgs) => F6Result) => (...args: F4NextArgs) => F5Result, f6: (next: (...args: F6NextArgs) => F7Result) => (...args: F5NextArgs) => F6Result, f7: (next: (...args: F7NextArgs) => LastResult) => (...args: F6NextArgs) => F7Result, f8: (next: (...args: F8NextArgs) => LastResult) => (...args: F7NextArgs) => F8Result, last: (...args: F8NextArgs) => LastResult): (...args: F1Args) => F1Result;
declare function compose<F1Result, F1Args extends any[], F1NextArgs extends any[], F2NextArgs extends any[], F2Result, F3NextArgs extends any[], F3Result, F4NextArgs extends any[], F4Result, F5NextArgs extends any[], F5Result, F6NextArgs extends any[], F6Result, F7NextArgs extends any[], F7Result, F8NextArgs extends any[], F8Result, F9NextArgs extends any[], F9Result, LastResult>(f1: (next: (...args: F1NextArgs) => F2Result) => (...args: F1Args) => F1Result, f2: (next: (...args: F2NextArgs) => F3Result) => (...args: F1NextArgs) => F2Result, f3: (next: (...args: F3NextArgs) => F4Result) => (...args: F2NextArgs) => F3Result, f4: (next: (...args: F4NextArgs) => F5Result) => (...args: F3NextArgs) => F4Result, f5: (next: (...args: F5NextArgs) => F6Result) => (...args: F4NextArgs) => F5Result, f6: (next: (...args: F6NextArgs) => F7Result) => (...args: F5NextArgs) => F6Result, f7: (next: (...args: F7NextArgs) => LastResult) => (...args: F6NextArgs) => F7Result, f8: (next: (...args: F8NextArgs) => LastResult) => (...args: F7NextArgs) => F8Result, f9: (next: (...args: F9NextArgs) => LastResult) => (...args: F8NextArgs) => F9Result, last: (...args: F9NextArgs) => LastResult): (...args: F1Args) => F1Result;
/**
 * This type produces the type array of TItems with all the type items
 * in TItemsToRemove removed from the start of the array type.
 *
 * @example
 * ```
 * RemoveItemsInFront<[number, number], [number]> = [number]
 * RemoveItemsInFront<[File, number, string], [File, number]> = [string]
 * ```
 */
type RemoveItemsInFront<TItems extends any[], TItemsToRemove extends any[]> = TItems extends [...TItemsToRemove, ...infer TRest] ? TRest : TItems;
declare const partial: <T extends any[], TA extends Partial<T>, R>(fn: (...args: T) => R, ...args: TA) => (...rest: RemoveItemsInFront<T, TA>) => R;
/**
 * Like partial but for unary functions that accept
 * a single object argument
 */
declare const partob: <T, K, PartialArgs extends Partial<T>>(fn: (args: T) => K, argobj: PartialArgs) => (restobj: Omit<T, keyof PartialArgs>) => K;
/**
 * Creates a Proxy object that will dynamically
 * call the handler argument when attributes are
 * accessed
 */
declare const proxied: <T, K>(handler: (propertyName: T) => K) => Record<string, K>;
/**
 * Creates a memoized function. The returned function
 * will only execute the source function when no value
 * has previously been computed. If a ttl (milliseconds)
 * is given previously computed values will be checked
 * for expiration before being returned.
 */
declare const memo: <TArgs extends any[], TResult>(func: (...args: TArgs) => TResult, options?: {
    key?: ((...args: TArgs) => string) | undefined;
    ttl?: number | undefined;
}) => (...args: TArgs) => TResult;
type DebounceFunction<TArgs extends any[]> = {
    (...args: TArgs): void;
    /**
     * Cancels the debounced function
     */
    cancel(): void;
    /**
     * Checks if there is any invocation debounced
     */
    isPending(): boolean;
    /**
     * Runs the debounced function immediately
     */
    flush(...args: TArgs): void;
};
type ThrottledFunction<TArgs extends any[]> = {
    (...args: TArgs): void;
    /**
     * Checks if there is any invocation throttled
     */
    isThrottled(): boolean;
};
/**
 * Given a delay and a function returns a new function
 * that will only call the source function after delay
 * milliseconds have passed without any invocations.
 *
 * The debounce function comes with a `cancel` method
 * to cancel delayed `func` invocations and a `flush`
 * method to invoke them immediately
 */
declare const debounce: <TArgs extends any[]>({ delay }: {
    delay: number;
}, func: (...args: TArgs) => any) => DebounceFunction<TArgs>;
/**
 * Given an interval and a function returns a new function
 * that will only call the source function if interval milliseconds
 * have passed since the last invocation
 */
declare const throttle: <TArgs extends any[]>({ interval }: {
    interval: number;
}, func: (...args: TArgs) => any) => ThrottledFunction<TArgs>;
/**
 * Make an object callable. Given an object and a function
 * the returned object will be a function with all the
 * objects properties.
 *
 * @example
 * ```typescript
 * const car = callable({
 *   wheels: 2
 * }, self => () => {
 *   return 'driving'
 * })
 *
 * car.wheels // => 2
 * car() // => 'driving'
 * ```
 */
declare const callable: <TValue, TObj extends Record<string | number | symbol, TValue>, TFunc extends (...args: any) => any>(obj: TObj, fn: (self: TObj) => TFunc) => TObj & TFunc;

/**
 * Checks if the given number is between zero (0) and the ending number. 0 is inclusive.
 *
 * * Numbers can be negative or positive.
 * * Ending number is exclusive.
 *
 * @param {number} number The number to check.
 * @param {number} end The end of the range. Exclusive.
 * @returns {boolean} Returns `true` if `number` is in the range, else `false`.
 */
declare function inRange(number: number, end: number): boolean;
/**
 * Checks if the given number is between two numbers.
 *
 * * Numbers can be negative or positive.
 * * Starting number is inclusive.
 * * Ending number is exclusive.
 * * The start and the end of the range can be ascending OR descending order.
 *
 * @param {number} number The number to check.
 * @param {number} start The start of the range. Inclusive.
 * @param {number} end The end of the range. Exclusive.
 * @returns {boolean} Returns `true` if `number` is in the range, else `false`.
 */
declare function inRange(number: number, start: number, end: number): boolean;
declare const toFloat: <T extends number | null = number>(value: any, defaultValue?: T | undefined) => number | T;
declare const toInt: <T extends number | null = number>(value: any, defaultValue?: T | undefined) => number | T;

type LowercasedKeys<T extends Record<string, any>> = {
    [P in keyof T & string as Lowercase<P>]: T[P];
};
type UppercasedKeys<T extends Record<string, any>> = {
    [P in keyof T & string as Uppercase<P>]: T[P];
};
/**
 * Removes (shakes out) undefined entries from an
 * object. Optional second argument shakes out values
 * by custom evaluation.
 */
declare const shake: <RemovedKeys extends string, T>(obj: T, filter?: (value: any) => boolean) => Omit<T, RemovedKeys>;
/**
 * Map over all the keys of an object to return
 * a new object
 */
declare const mapKeys: <TValue, TKey extends string | number | symbol, TNewKey extends string | number | symbol>(obj: Record<TKey, TValue>, mapFunc: (key: TKey, value: TValue) => TNewKey) => Record<TNewKey, TValue>;
/**
 * Map over all the keys to create a new object
 */
declare const mapValues: <TValue, TKey extends string | number | symbol, TNewValue>(obj: Record<TKey, TValue>, mapFunc: (value: TValue, key: TKey) => TNewValue) => Record<TKey, TNewValue>;
/**
 * Map over all the keys to create a new object
 */
declare const mapEntries: <TKey extends string | number | symbol, TValue, TNewKey extends string | number | symbol, TNewValue>(obj: Record<TKey, TValue>, toEntry: (key: TKey, value: TValue) => [TNewKey, TNewValue]) => Record<TNewKey, TNewValue>;
/**
 * Returns an object with { [keys]: value }
 * inverted as { [value]: key }
 */
declare const invert: <TKey extends string | number | symbol, TValue extends string | number | symbol>(obj: Record<TKey, TValue>) => Record<TValue, TKey>;
/**
 * Convert all keys in an object to lower case
 */
declare const lowerize: <T extends Record<string, any>>(obj: T) => LowercasedKeys<T>;
/**
 * Convert all keys in an object to upper case
 */
declare const upperize: <T extends Record<string, any>>(obj: T) => UppercasedKeys<T>;
/**
 * Creates a shallow copy of the given obejct/value.
 * @param {*} obj value to clone
 * @returns {*} shallow clone of the given value
 */
declare const clone: <T>(obj: T) => T;
/**
 * Convert an object to a list, mapping each entry
 * into a list item
 */
declare const listify: <TValue, TKey extends string | number | symbol, KResult>(obj: Record<TKey, TValue>, toItem: (key: TKey, value: TValue) => KResult) => KResult[];
/**
 * Pick a list of properties from an object
 * into a new object
 */
declare const pick: <T extends object, TKeys extends keyof T>(obj: T, keys: TKeys[]) => Pick<T, TKeys>;
/**
 * Omit a list of properties from an object
 * returning a new object with the properties
 * that remain
 */
declare const omit: <T, TKeys extends keyof T>(obj: T, keys: TKeys[]) => Omit<T, TKeys>;
/**
 * Dynamically get a nested value from an array or
 * object with a string.
 *
 * @example get(person, 'friends[0].name')
 */
declare const get: <TDefault = unknown>(value: any, path: string, defaultValue?: TDefault | undefined) => TDefault;
/**
 * Opposite of get, dynamically set a nested value into
 * an object using a key path. Does not modify the given
 * initial object.
 *
 * @example
 * set({}, 'name', 'ra') // => { name: 'ra' }
 * set({}, 'cards[0].value', 2) // => { cards: [{ value: 2 }] }
 */
declare const set: <T extends object, K>(initial: T, path: string, value: K) => T;
/**
 * Merges two objects together recursivly into a new
 * object applying values from right to left.
 * Recursion only applies to child object properties.
 */
declare const assign: <X extends Record<string | number | symbol, any>>(initial: X, override: X) => X;
/**
 * Get a string list of all key names that exist in
 * an object (deep).
 *
 * @example
 * keys({ name: 'ra' }) // ['name']
 * keys({ name: 'ra', children: [{ name: 'hathor' }] }) // ['name', 'children.0.name']
 */
declare const keys: <TValue extends object>(value: TValue) => string[];
/**
 * Flattens a deep object to a single demension, converting
 * the keys to dot notation.
 *
 * @example
 * crush({ name: 'ra', children: [{ name: 'hathor' }] })
 * // { name: 'ra', 'children.0.name': 'hathor' }
 */
declare const crush: <TValue extends object>(value: TValue) => object;
/**
 * The opposite of crush, given an object that was
 * crushed into key paths and values will return
 * the original object reconstructed.
 *
 * @example
 * construct({ name: 'ra', 'children.0.name': 'hathor' })
 * // { name: 'ra', children: [{ name: 'hathor' }] }
 */
declare const construct: <TObject extends object>(obj: TObject) => object;

/**
 * Generates a random number between min and max
 */
declare const random: (min: number, max: number) => number;
/**
 * Draw a random item from a list. Returns
 * null if the list is empty
 */
declare const draw: <T>(array: readonly T[]) => T | null;
declare const shuffle: <T>(array: readonly T[]) => T[];
declare const uid: (length: number, specials?: string) => string;

/**
 * Creates a series object around a list of values
 * that should be treated with order.
 */
declare const series: <T>(items: T[], toKey?: (item: T) => string | symbol) => {
    min: (a: T, b: T) => T;
    max: (a: T, b: T) => T;
    first: () => T;
    last: () => T;
    next: (current: T, defaultValue?: T | undefined) => T;
    previous: (current: T, defaultValue?: T | undefined) => T;
    spin: (current: T, num: number) => T;
};

/**
 * Capitalize the first word of the string
 *
 * capitalize('hello')   -> 'Hello'
 * capitalize('va va voom') -> 'Va va voom'
 */
declare const capitalize: (str: string) => string;
/**
 * Formats the given string in camel case fashion
 *
 * camel('hello world')   -> 'helloWorld'
 * camel('va va-VOOM') -> 'vaVaVoom'
 * camel('helloWorld') -> 'helloWorld'
 */
declare const camel: (str: string) => string;
/**
 * Formats the given string in snake case fashion
 *
 * snake('hello world')   -> 'hello_world'
 * snake('va va-VOOM') -> 'va_va_voom'
 * snake('helloWord') -> 'hello_world'
 */
declare const snake: (str: string, options?: {
    splitOnNumber?: boolean;
}) => string;
/**
 * Formats the given string in dash case fashion
 *
 * dash('hello world')   -> 'hello-world'
 * dash('va va_VOOM') -> 'va-va-voom'
 * dash('helloWord') -> 'hello-word'
 */
declare const dash: (str: string) => string;
/**
 * Formats the given string in pascal case fashion
 *
 * pascal('hello world') -> 'HelloWorld'
 * pascal('va va boom') -> 'VaVaBoom'
 */
declare const pascal: (str: string) => string;
/**
 * Formats the given string in title case fashion
 *
 * title('hello world') -> 'Hello World'
 * title('va_va_boom') -> 'Va Va Boom'
 * title('root-hook') -> 'Root Hook'
 * title('queryItems') -> 'Query Items'
 */
declare const title: (str: string | null | undefined) => string;
/**
 * template is used to replace data by name in template strings.
 * The default expression looks for {{name}} to identify names.
 *
 * Ex. template('Hello, {{name}}', { name: 'ray' })
 * Ex. template('Hello, <name>', { name: 'ray' }, /<(.+?)>/g)
 */
declare const template: (str: string, data: Record<string, any>, regex?: RegExp) => string;
/**
 * Trims all prefix and suffix characters from the given
 * string. Like the builtin trim function but accepts
 * other characters you would like to trim and trims
 * multiple characters.
 *
 * ```typescript
 * trim('  hello ') // => 'hello'
 * trim('__hello__', '_') // => 'hello'
 * trim('/repos/:owner/:repo/', '/') // => 'repos/:owner/:repo'
 * trim('222222__hello__1111111', '12_') // => 'hello'
 * ```
 */
declare const trim: (str: string | null | undefined, charsToTrim?: string) => string;

declare const isSymbol: (value: any) => value is symbol;
declare const isArray: (arg: any) => arg is any[];
declare const isObject: (value: any) => value is object;
/**
 * Checks if the given value is primitive.
 *
 * Primitive Types: number , string , boolean , symbol, bigint, undefined, null
 *
 * @param {*} value value to check
 * @returns {boolean} result
 */
declare const isPrimitive: (value: any) => boolean;
declare const isFunction: (value: any) => value is Function;
declare const isString: (value: any) => value is string;
declare const isInt: (value: any) => value is number;
declare const isFloat: (value: any) => value is number;
declare const isNumber: (value: any) => value is number;
declare const isDate: (value: any) => value is Date;
/**
 * This is really a _best guess_ promise checking. You
 * should probably use Promise.resolve(value) to be 100%
 * sure you're handling it correctly.
 */
declare const isPromise: (value: any) => value is Promise<any>;
declare const isEmpty: (value: any) => boolean;
declare const isEqual: <TType>(x: TType, y: TType) => boolean;

export { AggregateError, all, alphabetical, assign, boil, callable, camel, capitalize, chain, clone, cluster, compose, construct, counting, crush, dash, debounce, defer, diff, draw, first, flat, fork, get, group, guard, inRange, intersects, invert, isArray, isDate, isEmpty, isEqual, isFloat, isFunction, isInt, isNumber, isObject, isPrimitive, isPromise, isString, isSymbol, iterate, keys, last, list, listify, lowerize, map, mapEntries, mapKeys, mapValues, max, memo, merge, min, objectify, omit, parallel, partial, partob, pascal, pick, proxied, random, range, reduce, replace, replaceOrAppend, retry, select, series, set, shake, shift, shuffle, sift, sleep, snake, sort, sum, template, throttle, title, toFloat, toInt, toggle, trim, tryit as try, tryit, uid, unique, upperize, zip, zipToObject };
