type RecordToTuple<T> = {
  [K in keyof T]: [K, T[K]];
}[keyof T][];

export class RuntimeContext<Values extends Record<string, any> | unknown = unknown> {
  private registry = new Map<string, unknown>();

  constructor(
    iterable?: Values extends Record<string, any>
      ? RecordToTuple<Partial<Values>>
      : Iterable<readonly [string, unknown]>,
  ) {
    this.registry = new Map(iterable);
  }

  /**
   * set a value with strict typing if `Values` is a Record and the key exists in it.
   */
  public set<K extends Values extends Record<string, any> ? keyof Values : string>(
    key: K,
    value: Values extends Record<string, any> ? (K extends keyof Values ? Values[K] : never) : unknown,
  ): void {
    // The type assertion `key as string` is safe because K always extends string ultimately.
    this.registry.set(key as string, value);
  }

  /**
   * Get a value with its type
   */
  public get<
    K extends Values extends Record<string, any> ? keyof Values : string,
    R = Values extends Record<string, any> ? (K extends keyof Values ? Values[K] : never) : unknown,
  >(key: K): R {
    return this.registry.get(key as string) as R;
  }

  /**
   * Check if a key exists in the container
   */
  public has<K extends Values extends Record<string, any> ? keyof Values : string>(key: K): boolean {
    return this.registry.has(key);
  }

  /**
   * Delete a value by key
   */
  public delete<K extends Values extends Record<string, any> ? keyof Values : string>(key: K): boolean {
    return this.registry.delete(key);
  }

  /**
   * Clear all values from the container
   */
  public clear(): void {
    this.registry.clear();
  }

  /**
   * Get all keys in the container
   */
  public keys<R = Values extends Record<string, any> ? keyof Values : string>(): IterableIterator<R> {
    return this.registry.keys() as IterableIterator<R>;
  }

  /**
   * Get all values in the container
   */
  public values<R = Values extends Record<string, any> ? Values[keyof Values] : unknown>(): IterableIterator<R> {
    return this.registry.values() as IterableIterator<R>;
  }

  /**
   * Get all entries in the container
   */
  public entries<R = Values extends Record<string, any> ? Values[keyof Values] : unknown>(): IterableIterator<
    [string, R]
  > {
    return this.registry.entries() as IterableIterator<[string, R]>;
  }

  /**
   * Get the size of the container
   */
  public size(): number {
    return this.registry.size;
  }

  /**
   * Execute a function for each entry in the container
   */
  public forEach<T = any>(callbackfn: (value: T, key: string, map: Map<string, any>) => void): void {
    this.registry.forEach(callbackfn as any);
  }

  /**
   * Custom JSON serialization method
   * Converts the internal Map to a plain object for proper JSON serialization
   */
  public toJSON(): Record<string, any> {
    return Object.fromEntries(this.registry);
  }
}
