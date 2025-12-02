import { C as ProxifiedValue, D as detectCodeFormat, E as CodeFormatOptions, O as Options, S as ProxifiedObject, T as ProxyType, _ as ProxifiedImportsMap, a as Token, b as ProxifiedModule, c as Proxified, d as ProxifiedBinaryExpression, f as ProxifiedBlockStatement, g as ProxifiedImportItem, h as ProxifiedIdentifier, i as ParsedFileNode, l as ProxifiedArray, m as ProxifiedFunctionExpression, n as GenerateOptions, o as BinaryOperator, p as ProxifiedFunctionCall, r as Loc, s as ImportItemInput, t as ASTNode, u as ProxifiedArrowFunctionExpression, v as ProxifiedLogicalExpression, w as ProxyBase, x as ProxifiedNewExpression, y as ProxifiedMemberExpression } from "./types-CQa2aD_O.js";

//#region src/code.d.ts
declare function parseModule<Exports extends object = any>(code: string, options?: Options): ProxifiedModule<Exports>;
declare function parseExpression<T>(code: string, options?: Options): Proxified<T>;
declare function generateCode(node: {
  $ast: ASTNode;
} | ASTNode | ProxifiedModule<any>, options?: GenerateOptions): {
  code: string;
  map?: any;
};
declare function loadFile<Exports extends object = any>(filename: string, options?: Options): Promise<ProxifiedModule<Exports>>;
declare function writeFile(node: {
  $ast: ASTNode;
} | ASTNode, filename: string, options?: Options): Promise<void>;
//#endregion
//#region src/error.d.ts
interface MagicastErrorOptions {
  ast?: ASTNode;
  code?: string;
}
declare class MagicastError extends Error {
  rawMessage: string;
  options?: MagicastErrorOptions;
  constructor(message: string, options?: MagicastErrorOptions);
}
//#endregion
//#region src/builders.d.ts
declare const builders: {
  /**
   * Create a function call node.
   */
  functionCall(callee: string, ...args: any[]): Proxified;
  /**
   * Create a new expression node.
   */
  newExpression(callee: string, ...args: any[]): Proxified;
  /**
   * Create a binary expression node.
   */
  binaryExpression(left: any, operator: "==" | "!=" | "===" | "!==" | "<" | "<=" | ">" | ">=" | "<<" | ">>" | ">>>" | "+" | "-" | "*" | "/" | "%" | "&" | "|" | "^" | "in" | "instanceof" | "**", right: any): Proxified;
  /**
   * Create a proxified version of a literal value.
   */
  literal(value: any): Proxified;
  /**
   * Parse a raw expression and return a proxified version of it.
   *
   * ```ts
   * const obj = builders.raw("{ foo: 1 }");
   * console.log(obj.foo); // 1
   * ```
   */
  raw(code: string): Proxified;
};
//#endregion
export { ASTNode, BinaryOperator, CodeFormatOptions, GenerateOptions, ImportItemInput, Loc, MagicastError, MagicastErrorOptions, ParsedFileNode, Proxified, ProxifiedArray, ProxifiedArrowFunctionExpression, ProxifiedBinaryExpression, ProxifiedBlockStatement, ProxifiedFunctionCall, ProxifiedFunctionExpression, ProxifiedIdentifier, ProxifiedImportItem, ProxifiedImportsMap, ProxifiedLogicalExpression, ProxifiedMemberExpression, ProxifiedModule, ProxifiedNewExpression, ProxifiedObject, ProxifiedValue, ProxyBase, ProxyType, Token, builders, detectCodeFormat, generateCode, loadFile, parseExpression, parseModule, writeFile };