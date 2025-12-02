type NextFunction<V> = () => IteratorResult<V>;

export default class Iterator<V> implements IterableIterator<V> {

  // Constructor
  constructor(next: NextFunction<V>);

  // Members
  done: boolean;

  // Well-known methods
  next(): IteratorResult<V>;
  [Symbol.iterator](): IterableIterator<V>;

  // Static methods
  static of<T>(...args: T[]): Iterator<T>;
  static empty<T>(): Iterator<T>;
  static is(value: any): boolean;
}
