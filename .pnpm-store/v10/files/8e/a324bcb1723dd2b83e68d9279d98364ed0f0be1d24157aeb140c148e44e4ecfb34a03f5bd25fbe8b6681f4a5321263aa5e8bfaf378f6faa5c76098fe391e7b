//#region src/types/helper.d.ts
type Primitive = string | number | symbol | bigint | boolean | null | undefined;
type LiteralString = "" | (string & Record<never, never>);
type LiteralNumber = 0 | (number & Record<never, never>);
type Awaitable<T> = Promise<T> | T;
type OmitId<T extends {
  id: unknown;
}> = Omit<T, "id">;
type Prettify<T> = Omit<T, never>;
type PreserveJSDoc<T> = { [K in keyof T]: T[K] } & {};
type PrettifyDeep<T> = { [K in keyof T]: T[K] extends ((...args: any[]) => any) ? T[K] : T[K] extends object ? T[K] extends Array<any> ? T[K] : T[K] extends Date ? T[K] : PrettifyDeep<T[K]> : T[K] } & {};
type LiteralUnion<LiteralType, BaseType extends Primitive> = LiteralType | (BaseType & Record<never, never>);
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends ((k: infer I) => void) ? I : never;
type RequiredKeysOf<BaseType extends object> = Exclude<{ [Key in keyof BaseType]: BaseType extends Record<Key, BaseType[Key]> ? Key : never }[keyof BaseType], undefined>;
type HasRequiredKeys<BaseType extends object> = RequiredKeysOf<BaseType> extends never ? false : true;
type WithoutEmpty<T> = T extends T ? ({} extends T ? never : T) : never;
type StripEmptyObjects<T> = T extends { [K in keyof T]: never } ? never : T extends object ? { [K in keyof T as T[K] extends never ? never : K]: T[K] } : T;
type DeepPartial<T> = T extends Function ? T : T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;
type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;
//#endregion
export { LiteralNumber as a, OmitId as c, PrettifyDeep as d, Primitive as f, WithoutEmpty as g, UnionToIntersection as h, HasRequiredKeys as i, PreserveJSDoc as l, StripEmptyObjects as m, DeepPartial as n, LiteralString as o, RequiredKeysOf as p, Expand as r, LiteralUnion as s, Awaitable as t, Prettify as u };