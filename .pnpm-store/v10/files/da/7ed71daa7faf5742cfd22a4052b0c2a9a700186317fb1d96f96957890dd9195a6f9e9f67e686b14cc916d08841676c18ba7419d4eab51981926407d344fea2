/** Adjusted from https://stackoverflow.com/a/72801672/4575540.
 *  Useful for checking if we could not infer a concrete literal type
 *  (i.e. if instead of 'JSONEachRow' or other literal we just get a generic {@link DataFormat} as an argument). */
export type IsSame<A, B> = [A] extends [B] ? B extends A ? true : false : false;
