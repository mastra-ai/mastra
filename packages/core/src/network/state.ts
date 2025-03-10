/**
 * Network State using a JavaScript Map
 */
export class NetworkState {
  private state: Map<string, any>;

  constructor(initialState?: Record<string, any>) {
    this.state = new Map(Object.entries(initialState || {}));
  }

  /**
   * Get a value from the state
   */
  get<T = any>(key: string): T | undefined {
    return this.state.get(key) as T | undefined;
  }

  /**
   * Set a value in the state
   */
  set(key: string, value: any): void {
    this.state.set(key, value);
  }

  /**
   * Update multiple values in the state
   */
  update(values: Record<string, any>): void {
    Object.entries(values).forEach(([key, value]) => {
      this.state.set(key, value);
    });
  }

  /**
   * Check if a key exists in the state
   */
  has(key: string): boolean {
    return this.state.has(key);
  }

  /**
   * Delete a key from the state
   */
  delete(key: string): boolean {
    return this.state.delete(key);
  }

  /**
   * Get all state as an object
   */
  toObject(): Record<string, any> {
    return Object.fromEntries(this.state);
  }

  /**
   * Create a clone of the state
   */
  clone(): NetworkState {
    return new NetworkState(this.toObject());
  }
}
