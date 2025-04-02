export class Container {
  private registry = new Map<string, unknown>();

  constructor(iterable?: Iterable<readonly [string, unknown]> | null) {
    this.registry = new Map(iterable);
  }

  /**
   * Register a value with a specific type
   */
  public register<T>(key: string, value: T): void {
    this.registry.set(key, value);
  }

  /**
   * Get a value with its type
   */
  public get<T>(key: string): T | undefined {
    return this.registry.get(key) as T | undefined;
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
  public keys(): IterableIterator<string> {
    return this.registry.keys();
  }

  /**
   * Get all values in the container
   */
  public values<T = any>(): IterableIterator<T> {
    return this.registry.values() as IterableIterator<T>;
  }

  /**
   * Get all entries in the container
   */
  public entries<T = any>(): IterableIterator<[string, T]> {
    return this.registry.entries() as IterableIterator<[string, T]>;
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
}
