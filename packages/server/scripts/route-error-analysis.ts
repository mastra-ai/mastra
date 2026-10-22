/**
 * Static analysis of the business error codes each built-in route can return.
 *
 * For every `createRoute` / `createPublicRoute` / `createNewRoute` call in `src/`, walks the
 * route's handler and every server-side function or method it calls, collecting each
 * `SERVER_ERROR_CODES.X` reference it can reach.
 *
 * Two kinds of codes can't be found this way and must be declared by hand in the route's `errors`:
 * - codes that `handleError` maps from core errors (run-claim conflicts, dataset errors, ...),
 *   because the code comes from the core error's id at runtime;
 * - codes thrown by packages outside `src/` (voice routes).
 *
 * Used by `check-route-errors.ts`.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import ts from 'typescript-classic';

import { AUTH_ERROR_CODES, COMMON_ERROR_CODES } from '../src/server/error-codes/index.js';

const ROUTE_FACTORIES = new Set(['createRoute', 'createPublicRoute', 'createNewRoute']);

/** Functions whose codes depend on the error they receive, so walking their body over-reports. */
const OPAQUE_FUNCTIONS = new Set(['handleError']);

export type AnalyzedRoute = {
  /** Variable the route is assigned to, or `<anon>`. */
  name: string;
  file: string;
  line: number;
  /** Public routes skip authentication, so they can't return `AUTH_ERROR_CODES`. */
  isPublic: boolean;
  /** Codes listed in the route's `errors`, or `undefined` when the route declares none. */
  declared: string[] | undefined;
  /** Codes the route's handler can reach. */
  reachable: string[];
  /** The config object literal that holds `handler` (and `errors`). */
  config: ts.ObjectLiteralExpression;
};

function isRouteCall(e: ts.Node): e is ts.CallExpression {
  return ts.isCallExpression(e) && ts.isIdentifier(e.expression) && ROUTE_FACTORIES.has(e.expression.text);
}

function getProperty(obj: ts.ObjectLiteralExpression, name: string): ts.PropertyAssignment | undefined {
  return obj.properties.find(
    (p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === name,
  );
}

function declaredErrorCodes(config: ts.ObjectLiteralExpression): string[] | undefined {
  let errors = getProperty(config, 'errors')?.initializer;
  while (errors && (ts.isSatisfiesExpression(errors) || ts.isAsExpression(errors))) errors = errors.expression;
  return errors && ts.isArrayLiteralExpression(errors)
    ? errors.elements.map(e => (ts.isStringLiteral(e) ? e.text : e.getText()))
    : undefined;
}

export function analyzeRouteErrors(serverRoot: string): AnalyzedRoute[] {
  const srcRoot = path.join(serverRoot, 'src');
  const configPath = path.join(serverRoot, 'tsconfig.json');
  const cfg = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, serverRoot);
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const checker = program.getTypeChecker();

  const inServer = (f: ts.SourceFile) =>
    f.fileName.startsWith(srcRoot) && !/\.test\.ts$/.test(f.fileName) && !f.fileName.includes('__tests__');

  const codeRef = (node: ts.Node): string | undefined =>
    ts.isPropertyAccessExpression(node) && node.expression.getText() === 'SERVER_ERROR_CODES'
      ? node.name.text
      : undefined;

  const followBody = (d: ts.Declaration): ts.Node | undefined => {
    if (!inServer(d.getSourceFile())) return undefined;
    if (ts.isFunctionDeclaration(d) && d.name && OPAQUE_FUNCTIONS.has(d.name.text)) return undefined;
    if (ts.isFunctionDeclaration(d) || ts.isMethodDeclaration(d)) return d.body;
    if (ts.isVariableDeclaration(d) && d.initializer && !isRouteCall(d.initializer)) return d.initializer;
    return undefined;
  };

  const reusedRouteHandler = (node: ts.Node): ts.ObjectLiteralExpression | undefined => {
    if (!ts.isPropertyAccessExpression(node) || node.name.text !== 'handler' || !ts.isIdentifier(node.expression)) {
      return undefined;
    }
    let sym = checker.getSymbolAtLocation(node.expression);
    if (sym && sym.flags & ts.SymbolFlags.Alias) sym = checker.getAliasedSymbol(sym);
    const decl = sym?.declarations?.[0];
    if (!decl || !ts.isVariableDeclaration(decl) || !decl.initializer || !isRouteCall(decl.initializer)) {
      return undefined;
    }
    const factory = (decl.initializer.expression as ts.Identifier).text;
    const config = decl.initializer.arguments[factory === 'createNewRoute' ? 1 : 0];
    return config && ts.isObjectLiteralExpression(config) ? config : undefined;
  };

  const collect = (node: ts.Node, acc: Set<string>, visited: Set<ts.Node>) => {
    const code = codeRef(node);
    if (code) acc.add(code);

    let declarations: readonly ts.Declaration[] = [];
    if (ts.isIdentifier(node) && !(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node)) {
      let sym = checker.getSymbolAtLocation(node);
      if (sym && sym.flags & ts.SymbolFlags.Alias) sym = checker.getAliasedSymbol(sym);
      declarations = sym?.declarations ?? [];
    } else if (
      ts.isPropertyAccessExpression(node) &&
      ts.isCallExpression(node.parent) &&
      node.parent.expression === node
    ) {
      declarations = checker.getSymbolAtLocation(node.name)?.declarations ?? [];
    }
    for (const d of declarations) {
      const body = followBody(d);
      if (body && !visited.has(body)) {
        visited.add(body);
        collect(body, acc, visited);
      }
    }

    // `handler: OTHER_ROUTE.handler` reuses another route's handler, and with it the codes that route declares.
    const reused = reusedRouteHandler(node);
    if (reused && !visited.has(reused)) {
      visited.add(reused);
      for (const code of declaredErrorCodes(reused) ?? []) acc.add(code);
      const handler = getProperty(reused, 'handler')?.initializer;
      if (handler) collect(handler, acc, visited);
    }

    ts.forEachChild(node, child => collect(child, acc, visited));
  };

  const routes: AnalyzedRoute[] = [];
  for (const sf of program.getSourceFiles()) {
    if (!inServer(sf)) continue;
    const visit = (n: ts.Node) => {
      if (isRouteCall(n)) {
        const factory = (n.expression as ts.Identifier).text;
        // createNewRoute(def, config): the config is the second argument.
        const config = n.arguments[factory === 'createNewRoute' ? 1 : 0];
        // Route factories that forward a spread config (createPublicRoute, createNewRoute) aren't routes themselves.
        if (
          config &&
          ts.isObjectLiteralExpression(config) &&
          getProperty(config, 'handler') &&
          !config.properties.some(ts.isSpreadAssignment)
        ) {
          const requiresAuth = getProperty(config, 'requiresAuth');
          const acc = new Set<string>();
          collect(n, acc, new Set());
          routes.push({
            name: ts.isVariableDeclaration(n.parent) ? n.parent.name.getText() : '<anon>',
            file: path.relative(serverRoot, sf.fileName),
            line: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1,
            isPublic: factory === 'createPublicRoute' || requiresAuth?.initializer.kind === ts.SyntaxKind.FalseKeyword,
            declared: declaredErrorCodes(config),
            reachable: [...acc].sort(),
            config,
          });
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  return routes;
}

/** Codes every route can return without listing them: request/framework codes, plus auth codes unless public. */
export function frameworkErrorCodes(route: Pick<AnalyzedRoute, 'isPublic'>): Set<string> {
  return new Set<string>([...COMMON_ERROR_CODES, ...(route.isPublic ? [] : AUTH_ERROR_CODES)]);
}

/** Reachable codes the route doesn't declare (framework codes excluded). */
export function missingErrorCodes(route: AnalyzedRoute): string[] {
  const framework = frameworkErrorCodes(route);
  const declared = new Set(route.declared ?? []);
  return route.reachable.filter(code => !framework.has(code) && !declared.has(code));
}

/**
 * Rewrites each route's `errors` to the given codes (sorted), inserting the property right before
 * `handler` when the route has none. Returns the files it changed.
 */
export function writeRouteErrors(serverRoot: string, updates: Map<AnalyzedRoute, string[]>): string[] {
  const byFile = new Map<string, { start: number; end: number; text: string }[]>();
  for (const [route, codes] of updates) {
    const sf = route.config.getSourceFile();
    const list = `[${[...new Set(codes)]
      .sort()
      .map(c => `'${c}'`)
      .join(', ')}]`;
    const existing = getProperty(route.config, 'errors');
    const edits = byFile.get(sf.fileName) ?? [];
    if (existing) {
      edits.push({ start: existing.initializer.getStart(), end: existing.initializer.getEnd(), text: list });
    } else {
      const handler = getProperty(route.config, 'handler')!;
      const start = handler.getStart();
      const lineStart = sf.text.lastIndexOf('\n', start - 1) + 1;
      const indent = sf.text.slice(lineStart, start);
      edits.push({ start, end: start, text: `errors: ${list},\n${indent}` });
    }
    byFile.set(sf.fileName, edits);
  }
  for (const [file, edits] of byFile) {
    let text = fs.readFileSync(file, 'utf-8');
    for (const e of edits.sort((a, b) => b.start - a.start)) text = text.slice(0, e.start) + e.text + text.slice(e.end);
    fs.writeFileSync(file, text);
  }
  return [...byFile.keys()].map(f => path.relative(serverRoot, f));
}
