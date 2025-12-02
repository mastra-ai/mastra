import { o as LiteralString } from "./helper-DU33OcfW.mjs";

//#region src/plugins/access/types.d.ts
type SubArray<T$1 extends unknown[] | readonly unknown[] | any[]> = T$1[number][];
type Subset<K extends keyof R, R extends Record<string | LiteralString, readonly string[] | readonly LiteralString[]>> = { [P in K]: SubArray<R[P]> };
type Statements = {
  readonly [resource: string]: readonly LiteralString[];
};
type AccessControl<TStatements extends Statements = Statements> = ReturnType<typeof createAccessControl<TStatements>>;
type Role<TStatements extends Statements = Record<string, any>> = {
  authorize: (request: any, connector?: ("OR" | "AND") | undefined) => AuthorizeResponse;
  statements: TStatements;
};
//#endregion
//#region src/plugins/access/access.d.ts
type AuthorizeResponse = {
  success: false;
  error: string;
} | {
  success: true;
  error?: never | undefined;
};
declare function role<TStatements extends Statements>(statements: TStatements): {
  authorize<K extends keyof TStatements>(request: { [key in K]?: TStatements[key] | {
    actions: TStatements[key];
    connector: "OR" | "AND";
  } }, connector?: "OR" | "AND"): AuthorizeResponse;
  statements: TStatements;
};
declare function createAccessControl<const TStatements extends Statements>(s: TStatements): {
  newRole<K extends keyof TStatements>(statements: Subset<K, TStatements>): {
    authorize<K_1 extends K>(request: K_1 extends infer T extends keyof Subset<K, TStatements> ? { [key in T]?: Subset<K, TStatements>[key] | {
      actions: Subset<K, TStatements>[key];
      connector: "OR" | "AND";
    } | undefined } : never, connector?: "OR" | "AND"): AuthorizeResponse;
    statements: Subset<K, TStatements>;
  };
  statements: TStatements;
};
//#endregion
export { Role as a, Subset as c, AccessControl as i, createAccessControl as n, Statements as o, role as r, SubArray as s, AuthorizeResponse as t };