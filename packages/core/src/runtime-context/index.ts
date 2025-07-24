type RecordToTuple<T> = {
  [K in keyof T]: [K, T[K]];
}[keyof T][];

export interface RuntimeContextInterface extends Record<string, any> {}

export class RuntimeContext<Values extends RuntimeContextInterface = RuntimeContextInterface> {
  private registry: Map<string, any>;

  constructor(iterable?: Iterable<{ [K in keyof Values]: K extends string ? [K, Values[K]] : never }[keyof Values]>) {
    this.registry = new Map(iterable);
  }

  /**
   * set a value with strict typing if `Values` is a Record and the key exists in it.
   */
  public set<K extends keyof Values>(key: K, value: Values[K]): void {
    // The type assertion `key as string` is safe because K always extends string ultimately.
    this.registry.set(key as string, value);
  }

  /**
   * Get a value with its type
   */
  public get<K extends keyof Values>(key: K): Values[K] {
    return this.registry.get(key as string) as Values[K];
  }

  /**
   * Check if a key exists in the container
   */
  public has(key: string): boolean {
    return this.registry.has(key);
  }

  /**
   * Delete a value by key
   */
  public delete(key: string): boolean {
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
  public keys(): IterableIterator<keyof Values> {
    return this.registry.keys() as IterableIterator<keyof Values>;
  }

  /**
   * Get all values in the container
   */
  public values(): IterableIterator<Values[keyof Values]> {
    return this.registry.values() as IterableIterator<Values[keyof Values]>;
  }

  /**
   * Get all entries in the container
   */
  public entries(): IterableIterator<{ [K in keyof Values]: [K, Values[K]] }[keyof Values]> {
    return this.registry.entries() as IterableIterator<{ [K in keyof Values]: [K, Values[K]] }[keyof Values]>;
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
  public forEach<K extends keyof Values>(callbackfn: (value: Values[K], key: K, map: Map<string, any>) => void): void {
    this.registry.forEach(callbackfn as any);
  }
}
