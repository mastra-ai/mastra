/**
 * A type representing a constructor for a class of a given type.
 */
export type Constructor<T> = new (...args: any[]) => T;