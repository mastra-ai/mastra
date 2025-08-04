export interface RuntimeContextInterface {}

type StringKeys<T> = Extract<keyof T, string>;

export class RuntimeContext<Mapping extends RuntimeContextInterface = RuntimeContextInterface> {
  private registry: Map<string, any>;

  constructor(iterable?: Iterable<{ [K in StringKeys<Mapping>]: [K, Mapping[K]] }[StringKeys<Mapping>]>) {
    this.registry = new Map(iterable);
  }

  /**
   * set a value with strict typing if `Values` is a Record and the key exists in it.
   */
  public set<K extends string, V extends K extends StringKeys<Mapping> ? Mapping[K] : unknown>(key: K, value: V): void {
    this.registry.set(key, value);
  }

  /**
   * Get a value with its type
   */
  public get<K extends string>(key: K): K extends StringKeys<Mapping> ? Mapping[K] : unknown {
    return this.registry.get(key) as K extends StringKeys<Mapping> ? Mapping[K] : unknown;
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
  public keys(): MapIterator<StringKeys<Mapping> extends never ? string : StringKeys<Mapping>> {
    return this.registry.keys() as MapIterator<StringKeys<Mapping> extends never ? string : StringKeys<Mapping>>;
  }

  /**
   * Get all values in the container
   */
  public values(): MapIterator<Mapping[StringKeys<Mapping>]> {
    return this.registry.values() as MapIterator<Mapping[StringKeys<Mapping>]>;
  }

  /**
   * Get all entries in the container
   */
  public entries(): MapIterator<
    StringKeys<Mapping> extends never
      ? [string, unknown]
      : { [P in StringKeys<Mapping>]: [P, Mapping[P]] }[StringKeys<Mapping>]
  > {
    return this.registry.entries() as MapIterator<
      StringKeys<Mapping> extends never
        ? [string, unknown]
        : { [P in StringKeys<Mapping>]: [P, Mapping[P]] }[StringKeys<Mapping>]
    >;
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
  public forEach(callbackfn: (value: unknown, key: string, map: Map<string, unknown>) => void): void {
    this.registry.forEach(callbackfn);
  }
}
