/**
 * Tests if two types are exactly the same.
 * Taken from https://github.com/Microsoft/TypeScript/issues/27024#issuecomment-421529650
 * (Apache Version 2.0, January 2004)
 */
export type Equals<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
    ? true
    : false;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function assert<T extends true>() {
  // no need to do anything! we're just asserting at compile time that the type
  // parameter is true.
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function assertFalse<T extends false>() {
  // no need to do anything! we're just asserting at compile time that the type
  // parameter is false.
}
