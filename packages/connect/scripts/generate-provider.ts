#!/usr/bin/env node
/**
 * Generates shipped provider tools from NangoHQ/integration-templates.
 * Maintainer-only.
 *
 * Each action is emitted as an isolated module under:
 *
 *   src/providers/<provider>/tools/<action>.ts
 *
 * Only the action's public schemas are renamed and exported:
 *
 *   InputSchema  -> <actionName>InputSchema
 *   OutputSchema -> <actionName>OutputSchema
 *
 * All provider-response schemas, helper schemas, functions, and types remain
 * local to the action module. File isolation prevents collisions without
 * producing names such as `getModelModelSchema`.
 */
import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Node, Project, SyntaxKind } from 'ts-morph';
import type { CallExpression, ImportDeclaration, ObjectLiteralExpression, SourceFile, Statement } from 'ts-morph';
import { format, resolveConfig } from 'prettier';

import {
  assertProviderEnvVarAvailable,
  calculateFileChecksums,
  currentTemplateSha,
  providerConnectionEnvVar,
  providerDir,
  providerRegistrationName,
  providersDir,
  templatePath,
  validateProviderId,
} from './provider-utils.js';
import type { ProviderManifest } from './provider-utils.js';
import { templatePinFor } from './templates-config.js';
import type { TemplatePin } from './templates-config.js';

/** Module specifier the upstream templates import their SDK from. */
const TEMPLATE_SDK_MODULE = 'nango';
const PROXY_REQUEST_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'paginate', 'proxy']);
const PROXY_CONTEXT_METHODS = new Set([
  ...PROXY_REQUEST_METHODS,
  'getConnection',
  'getMetadata',
  'updateMetadata',
  'zodValidateInput',
  'ActionError',
  'log',
]);
/**
 * Proxy config keys that shipped templates use but the platform proxy cannot
 * honor. If a template sets any of these, the action is skipped rather than
 * silently ignoring the option. `responseType` is not listed because the
 * platform proxy handles `'arraybuffer'` (the only value templates actually
 * pass).
 */
const UNSUPPORTED_PROXY_OPTIONS: readonly string[] = [];
const ALLOWED_TEMPLATE_SDK_IMPORTS = new Set(['createAction', 'ProxyConfiguration']);

interface ActionCandidate {
  providerId: string;
  localId: string;
  file: string;
  actionSlug: string;
  toolKey: string;
}

interface ExtractedAction {
  candidate: ActionCandidate;
  description: string;
  inputSchemaName: string;
  outputSchemaName: string;
  toolFactoryName: string;
  moduleStatements: string[];
  execBody: string;
  usesProxyRequestType: boolean;
}

interface SkippedAction {
  candidate: ActionCandidate;
  reason: string;
}

function usage(): never {
  console.error('Usage: generate-provider <integrationId>');
  process.exit(2);
}

function toSnake(slug: string): string {
  return slug.replace(/-/g, '_');
}

function toPascal(slug: string): string {
  return slug
    .split(/[-_]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function toCamel(slug: string): string {
  const pascal = toPascal(slug);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function findCreateActionCall(source: SourceFile): CallExpression | undefined {
  for (const call of source.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expression = call.getExpression();
    if (Node.isIdentifier(expression) && expression.getText() === 'createAction') return call;
  }
  return undefined;
}

function callsTemplateContextMethod(source: SourceFile, methods: ReadonlySet<string>): boolean {
  return source.getDescendantsOfKind(SyntaxKind.CallExpression).some(call => {
    const expression = call.getExpression();
    return (
      Node.isPropertyAccessExpression(expression) &&
      expression.getExpression().getText() === 'nango' &&
      methods.has(expression.getName())
    );
  });
}

function readStringProperty(obj: ObjectLiteralExpression, name: string): string | undefined {
  const property = obj.getProperty(name);
  if (!property || !Node.isPropertyAssignment(property)) return undefined;
  const initializer = property.getInitializer();
  return initializer && Node.isStringLiteral(initializer) ? initializer.getLiteralValue() : undefined;
}

function readIdentifierPropertyInitializer(obj: ObjectLiteralExpression, name: string): string | undefined {
  const property = obj.getProperty(name);
  if (!property || !Node.isPropertyAssignment(property)) return undefined;
  const initializer = property.getInitializer();
  return initializer && Node.isIdentifier(initializer) ? initializer.getText() : undefined;
}

function normalizeSupportedRuntimeImports(source: SourceFile): void {
  for (const declaration of source.getImportDeclarations()) {
    const moduleName = declaration.getModuleSpecifierValue();
    if (moduleName !== 'crypto' && moduleName !== 'node:crypto') continue;

    const namedImports = declaration.getNamedImports();
    if (
      declaration.getDefaultImport() ||
      declaration.getNamespaceImport() ||
      namedImports.length !== 1 ||
      namedImports[0]!.getName() !== 'randomUUID' ||
      namedImports[0]!.getAliasNode()
    ) {
      continue;
    }

    declaration.replaceWithText('const randomUUID = () => globalThis.crypto.randomUUID();');
  }
}

function unsupportedImportReason(source: SourceFile): string | undefined {
  for (const declaration of source.getImportDeclarations()) {
    const moduleName = declaration.getModuleSpecifierValue();
    if (moduleName !== 'zod' && moduleName !== TEMPLATE_SDK_MODULE) {
      return `imports unsupported module: ${moduleName}`;
    }
    if (moduleName !== TEMPLATE_SDK_MODULE) continue;

    const unsupported = declaration
      .getNamedImports()
      .map(namedImport => namedImport.getName())
      .filter(name => !ALLOWED_TEMPLATE_SDK_IMPORTS.has(name));
    if (unsupported.length > 0) {
      return `imports unsupported template SDK types: ${unsupported.join(', ')}`;
    }
  }
  return undefined;
}

function isGeneratedActionStatement(statement: Statement, createActionCall: CallExpression): boolean {
  return statement === createActionCall.getFirstAncestorByKind(SyntaxKind.VariableStatement);
}

function shouldKeepStatement(statement: Statement, createActionCall: CallExpression): boolean {
  if (Node.isImportDeclaration(statement)) return false;
  if (isGeneratedActionStatement(statement, createActionCall)) return false;
  if (Node.isExportAssignment(statement)) return false;
  // Templates alias their SDK context type locally; the generated module
  // imports `PlatformProxy` directly instead (the alias gets renamed first).
  if (Node.isTypeAliasDeclaration(statement) && statement.getName() === 'PlatformProxy') return false;
  return true;
}

function unsupportedTopLevelStatementReason(source: SourceFile, createActionCall: CallExpression): string | undefined {
  for (const statement of source.getStatements()) {
    if (!shouldKeepStatement(statement, createActionCall)) continue;
    if (
      Node.isVariableStatement(statement) ||
      Node.isFunctionDeclaration(statement) ||
      Node.isTypeAliasDeclaration(statement) ||
      Node.isInterfaceDeclaration(statement) ||
      Node.isEnumDeclaration(statement)
    ) {
      continue;
    }
    return `uses unsupported top-level statement: ${statement.getKindName()}`;
  }
  return undefined;
}

function usesNamedImport(declaration: ImportDeclaration, name: string): boolean {
  return declaration.getNamedImports().some(namedImport => namedImport.getName() === name);
}

function sanitizeVendoredSource(source: string): string {
  return (
    source
      .replace(/^.*@nangohq\/custom-integrations-linting\/.*\r?\n/gm, '')
      // Upstream `updateMetadata` typing forces templates to suppress the
      // call; against the platform proxy's signature the call type-checks,
      // so the directive would itself fail as unused.
      .replace(/^\s*\/\/\s*@ts-expect-error[^\n]*\r?\n(?=\s*(?:await\s+)?platformProxy\.updateMetadata\()/gm, '')
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isArrayInputField(inputSchemaText: string, field: string): boolean {
  return new RegExp(`(?:^|[\\s{,])${escapeRegExp(field)}\\s*:\\s*z\\s*\\.\\s*array\\s*\\(`).test(inputSchemaText);
}

/**
 * True when the exec reads `credentials` off the result of
 * `nango.getConnection()` — directly on the call, through a variable bound to
 * it, or by destructuring `credentials` from it. Reads of `.credentials` on
 * unrelated values (such as an input field named `credentials`) don't count,
 * so the generated tool never fetches a secret the action doesn't use.
 */
function execReadsConnectionCredentials(execInitializer: Node): boolean {
  // Unwrap `await` and parentheses so wrapped calls (e.g.
  // `await (nango.getConnection())`) resolve to the underlying expression.
  const unwrap = (node: Node): Node => {
    let current = node;
    while (Node.isParenthesizedExpression(current) || Node.isAwaitExpression(current)) {
      current = current.getExpression();
    }
    return current;
  };
  const isGetConnectionCall = (node: Node): boolean => {
    const call = unwrap(node);
    if (!Node.isCallExpression(call) || call.getArguments().length > 0) return false;
    const callee = call.getExpression();
    if (!Node.isPropertyAccessExpression(callee) || callee.getName() !== 'getConnection') return false;
    const receiver = unwrap(callee.getExpression());
    return Node.isIdentifier(receiver) && receiver.getText() === 'nango';
  };
  const connectionSymbols = new Set<unknown>();
  for (const declaration of execInitializer.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
    const initializer = declaration.getInitializer();
    if (!initializer || !isGetConnectionCall(initializer)) continue;
    const nameNode = declaration.getNameNode();
    if (Node.isIdentifier(nameNode)) {
      const symbol = nameNode.getSymbol();
      if (symbol) connectionSymbols.add(symbol);
    } else if (Node.isObjectBindingPattern(nameNode)) {
      // `const { credentials } = await nango.getConnection();` (or a rename
      // such as `{ credentials: creds }` — the property name is what counts).
      for (const element of nameNode.getElements()) {
        const propertyName = element.getPropertyNameNode()?.getText() ?? element.getName();
        if (propertyName === 'credentials') return true;
      }
    }
  }
  for (const access of execInitializer.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)) {
    if (access.getName() !== 'credentials') continue;
    const target = access.getExpression();
    if (isGetConnectionCall(target)) return true;
    // Resolve the identifier to its declaration so a shadowing binding with
    // the same name (e.g. a callback parameter) never counts as a read.
    if (Node.isIdentifier(target)) {
      const symbol = target.getSymbol();
      if (symbol && connectionSymbols.has(symbol)) return true;
    }
  }
  return false;
}

/**
 * Templates serialize every query parameter through an array-or-scalar
 * branch. The input schema already fixes each field's shape, so fields it
 * declares as scalars are serialized directly; array fields keep the join.
 */
function simplifyScalarQuerySerialization(execBody: string, inputSchemaText: string): string {
  return execBody.replace(
    /Array\.isArray\(input\[('[^']+')\]\)\s*\?\s*input\[\1\]\.join\(','\)\s*:\s*String\(input\[\1\]\)/g,
    (match, quoted: string) =>
      isArrayInputField(inputSchemaText, quoted.slice(1, -1)) ? match : `String(input[${quoted}])`,
  );
}

/**
 * Provider responses evolve independently of the template pin. Enums on the
 * response side accept any string so a new provider value never rejects an
 * otherwise valid response; request-side enums stay strict. When a response
 * schema builds on an input-side schema (e.g. via `.extend()`), a widened
 * clone of that input-side schema is emitted and the response side references
 * the clone, so the permissiveness survives schema reuse.
 */
function widenResponseEnums(statements: string[], inputSchemaName: string): string[] {
  const widenLiterals = (statement: string) =>
    statement.replace(/z\.enum\((\[[^\]]*\])\)(?!\.or\()/g, 'z.enum($1).or(z.string())');

  // Re-parse the vendored statements so declarations and their references
  // resolve as TypeScript symbols; text matching would confuse identifiers
  // that merely share a name (or appear inside string literals).
  const scratch = new Project({ useInMemoryFileSystem: true }).createSourceFile('scratch.ts', statements.join('\n'));
  const topLevel = scratch.getStatements();
  // A statement can declare several variables (`const A = …, B = …;`); track
  // every identifier-named declaration so the statement can be cloned as a
  // unit without emitting an unrenamed duplicate of a sibling declaration.
  const declared: string[][] = topLevel.map(statement => {
    if (!Node.isVariableStatement(statement)) return [];
    return statement
      .getDeclarations()
      .map(declaration => declaration.getNameNode())
      .filter(Node.isIdentifier)
      .map(nameNode => nameNode.getText());
  });
  const statementIndexOf = (node: Node): number =>
    topLevel.findIndex(statement => statement.getStart() <= node.getStart() && node.getEnd() <= statement.getEnd());

  // For each declared schema, resolve every identifier that references it and
  // record which top-level statement the reference sits in, plus its exact
  // span so a rename never touches lookalike text.
  interface SchemaReference {
    name: string;
    start: number;
    end: number;
  }
  const referencesByStatement: SchemaReference[][] = topLevel.map(() => []);
  const referencedNamesByStatement: Set<string>[] = topLevel.map(() => new Set());
  topLevel.forEach(statement => {
    if (!Node.isVariableStatement(statement)) return;
    for (const declaration of statement.getDeclarations()) {
      const nameNode = declaration.getNameNode();
      if (!Node.isIdentifier(nameNode)) continue;
      const name = nameNode.getText();
      for (const reference of nameNode.findReferencesAsNodes()) {
        if (reference === nameNode) continue;
        const referenceIndex = statementIndexOf(reference);
        if (referenceIndex < 0) continue;
        const statementStart = topLevel[referenceIndex]!.getStart();
        referencesByStatement[referenceIndex]!.push({
          name,
          start: reference.getStart() - statementStart,
          end: reference.getEnd() - statementStart,
        });
        referencedNamesByStatement[referenceIndex]!.add(name);
      }
    }
  });
  const declarationNameSpans = (index: number): SchemaReference[] => {
    const statement = topLevel[index]!;
    if (!Node.isVariableStatement(statement)) return [];
    return statement
      .getDeclarations()
      .map(declaration => declaration.getNameNode())
      .filter(Node.isIdentifier)
      .map(nameNode => ({
        name: nameNode.getText(),
        start: nameNode.getStart() - statement.getStart(),
        end: nameNode.getEnd() - statement.getStart(),
      }));
  };

  // Statements are classified as a unit: when any of a statement's
  // declarations is input-side, its siblings and everything it references are
  // input-side too.
  const inputSide = new Set<string>([inputSchemaName]);
  let changed = true;
  while (changed) {
    changed = false;
    topLevel.forEach((_, index) => {
      const names = declared[index]!;
      if (!names.some(name => inputSide.has(name))) return;
      for (const other of [...names, ...referencedNamesByStatement[index]!]) {
        if (!inputSide.has(other)) {
          inputSide.add(other);
          changed = true;
        }
      }
    });
  }

  // Input-side declarations whose inferred type would change if widened,
  // directly (literal enum) or through a reference to another such declaration.
  const enumBearing = new Set<string>();
  changed = true;
  while (changed) {
    changed = false;
    topLevel.forEach((statement, index) => {
      const names = declared[index]!.filter(name => inputSide.has(name) && !enumBearing.has(name));
      if (names.length === 0) return;
      const text = statement.getText();
      const carriesEnum =
        widenLiterals(text) !== text || [...enumBearing].some(other => referencedNamesByStatement[index]!.has(other));
      if (carriesEnum) {
        for (const name of names) enumBearing.add(name);
        changed = true;
      }
    });
  }

  // Enum-bearing input-side declarations the response side reaches, including
  // the ones their clones will need transitively. Cloning a statement clones
  // every declaration in it, so siblings enter the set together.
  const needsClone = new Set<string>();
  const visit = (name: string) => {
    if (needsClone.has(name)) return;
    const index = declared.findIndex(names => names.includes(name));
    if (index < 0) {
      needsClone.add(name);
      return;
    }
    for (const sibling of declared[index]!) needsClone.add(sibling);
    for (const other of enumBearing) {
      if (!needsClone.has(other) && referencedNamesByStatement[index]!.has(other)) visit(other);
    }
  };
  topLevel.forEach((_, index) => {
    if (declared[index]!.some(name => inputSide.has(name))) return;
    for (const candidate of enumBearing) {
      if (referencedNamesByStatement[index]!.has(candidate)) visit(candidate);
    }
  });

  // Rewrite recorded identifier spans back-to-front so earlier offsets stay
  // valid; only resolved references are touched, never coincidental text.
  const redirectToClones = (index: number, extraSpans: SchemaReference[] = []) => {
    const spans = [...referencesByStatement[index]!, ...extraSpans]
      .filter(span => needsClone.has(span.name))
      .sort((a, b) => b.start - a.start);
    let result = topLevel[index]!.getText();
    for (const span of spans) {
      result = `${result.slice(0, span.start)}${span.name}Widened${result.slice(span.end)}`;
    }
    return result;
  };

  return topLevel.flatMap((statement, index) => {
    if (declared[index]!.some(name => inputSide.has(name))) {
      if (!declared[index]!.some(name => needsClone.has(name))) return [statement.getText()];
      return [statement.getText(), widenLiterals(redirectToClones(index, declarationNameSpans(index)))];
    }
    return [widenLiterals(redirectToClones(index))];
  });
}

function replaceProxyRequestType(source: string, usesProxyRequestType: boolean): string {
  return usesProxyRequestType ? source.replace(/\bProxyConfiguration\b/g, 'PlatformProxyRequest') : source;
}

async function formatGeneratedFiles(directory: string): Promise<void> {
  const files = readdirSync(directory, { recursive: true })
    .filter((entry): entry is string => typeof entry === 'string' && entry.endsWith('.ts'))
    .map(entry => resolve(directory, entry));
  const config = (await resolveConfig(directory)) ?? {};

  await Promise.all(
    files.map(async file => {
      const formatted = await format(readFileSync(file, 'utf8'), { ...config, filepath: file });
      writeFileSync(file, formatted);
    }),
  );
}

function extractAction(
  project: Project,
  candidate: ActionCandidate,
): { kind: 'ok'; value: ExtractedAction } | { kind: 'skip'; reason: string } {
  const source = project.addSourceFileAtPath(candidate.file);
  normalizeSupportedRuntimeImports(source);
  const importReason = unsupportedImportReason(source);
  if (importReason) return { kind: 'skip', reason: importReason };

  const createActionCall = findCreateActionCall(source);
  if (!createActionCall) return { kind: 'skip', reason: 'no createAction() call found' };
  const topLevelStatementReason = unsupportedTopLevelStatementReason(source, createActionCall);
  if (topLevelStatementReason) return { kind: 'skip', reason: topLevelStatementReason };

  const argument = createActionCall.getArguments()[0];
  if (!argument || !Node.isObjectLiteralExpression(argument)) {
    return { kind: 'skip', reason: 'createAction argument is not an object literal' };
  }

  const inputName = readIdentifierPropertyInitializer(argument, 'input');
  const outputName = readIdentifierPropertyInitializer(argument, 'output');
  const execProperty = argument.getProperty('exec');
  if (!inputName || !outputName || !execProperty) {
    return { kind: 'skip', reason: 'missing identifier input/output or exec in createAction' };
  }
  if (inputName === outputName) {
    return { kind: 'skip', reason: 'input and output reference the same declaration' };
  }

  const inputDeclaration = source.getVariableDeclaration(inputName);
  const outputDeclaration = source.getVariableDeclaration(outputName);
  if (!inputDeclaration || !outputDeclaration) {
    return { kind: 'skip', reason: 'could not locate input/output schema declarations' };
  }

  const execInitializer = execProperty.asKindOrThrow(SyntaxKind.PropertyAssignment).getInitializerOrThrow();
  if (!Node.isArrowFunction(execInitializer) && !Node.isFunctionExpression(execInitializer)) {
    return { kind: 'skip', reason: 'exec is not an arrow/function expression' };
  }

  const execBodyNode = execInitializer.getBody();
  const originalExecBody = Node.isBlock(execBodyNode)
    ? execBodyNode.getText()
    : `{ return ${execBodyNode.getText()}; }`;
  const usedContextMethods = new Set<string>();
  for (const match of originalExecBody.matchAll(/\bnango\.([A-Za-z_$][\w$]*)/g)) {
    usedContextMethods.add(match[1]!);
  }
  const unsupportedMethods = [...usedContextMethods].filter(method => !PROXY_CONTEXT_METHODS.has(method));
  if (unsupportedMethods.length > 0) {
    return { kind: 'skip', reason: `exec uses unsupported template SDK helpers: ${unsupportedMethods.join(', ')}` };
  }
  // Templates that read `credentials` off the `nango.getConnection()` result
  // need the raw credential the platform proxy deliberately leaves out of
  // `getConnection()`. Their calls are rewritten below to
  // `getConnectionWithCredentials()`, which fetches it from the platform's
  // credential endpoint, so only these execs ever see a secret. Detection is
  // binding-aware: `.credentials` reads on unrelated values (for example a
  // `credentials` input field) don't trigger the rewrite.
  const readsCredentials = execReadsConnectionCredentials(execInitializer);
  const usesProviderProxy = callsTemplateContextMethod(source, PROXY_REQUEST_METHODS);
  if (!usesProviderProxy) {
    return { kind: 'skip', reason: 'exec does not call the provider proxy' };
  }
  const unsupportedProxyOptions = UNSUPPORTED_PROXY_OPTIONS.filter(option =>
    new RegExp(`\\b${option}\\s*:`).test(originalExecBody),
  );
  if (unsupportedProxyOptions.length > 0) {
    return { kind: 'skip', reason: `exec uses unsupported proxy options: ${unsupportedProxyOptions.join(', ')}` };
  }

  const actionName = toCamel(candidate.actionSlug);
  const inputSchemaName = `${actionName}InputSchema`;
  const outputSchemaName = `${actionName}OutputSchema`;
  inputDeclaration.rename(inputSchemaName);
  outputDeclaration.rename(outputSchemaName);
  inputDeclaration.getVariableStatementOrThrow().setIsExported(true);
  outputDeclaration.getVariableStatementOrThrow().setIsExported(true);

  // Rename template SDK bindings to their platform equivalents so the
  // generated module never references the upstream SDK by name.
  const templateSdkImports = source
    .getImportDeclarations()
    .filter(declaration => declaration.getModuleSpecifierValue() === TEMPLATE_SDK_MODULE);
  const usesProxyRequestType = templateSdkImports.some(declaration =>
    usesNamedImport(declaration, 'ProxyConfiguration'),
  );
  for (const templateSdkImport of templateSdkImports) {
    for (const namedImport of templateSdkImport.getNamedImports()) {
      const nameNode = namedImport.getNameNode();
      if (namedImport.getName() === 'ProxyConfiguration' && Node.isIdentifier(nameNode)) {
        nameNode.rename('PlatformProxyRequest');
      }
    }
  }
  for (const alias of source.getTypeAliases()) {
    if (alias.getName() === 'NangoActionLocal') {
      alias.rename('PlatformProxy');
    }
  }
  for (const parameter of source.getDescendantsOfKind(SyntaxKind.Parameter)) {
    if (parameter.getName() === 'nango') parameter.rename('platformProxy');
  }

  // Some templates skip the `NangoActionLocal` alias and type helper
  // parameters inline against the SDK context — either through the action
  // declaration (`Parameters<(typeof action)['exec']>[0]`) or through the
  // factory itself (`Parameters<Parameters<typeof createAction>[0]['exec']>[0]`).
  // Both names are stripped from the generated module, so rewrite those
  // references to the imported `PlatformProxy` type.
  const actionVariableName = createActionCall.getFirstAncestorByKind(SyntaxKind.VariableDeclaration)?.getName();
  const inlineContextTypes = new Set(
    [
      actionVariableName ? `Parameters<(typeof ${actionVariableName})['exec']>[0]` : undefined,
      "Parameters<Parameters<typeof createAction>[0]['exec']>[0]",
    ].filter((text): text is string => text !== undefined),
  );
  const inlineContextNodes = source
    .getDescendantsOfKind(SyntaxKind.IndexedAccessType)
    .filter(node => inlineContextTypes.has(node.getText()));
  for (const node of inlineContextNodes.reverse()) {
    if (!node.wasForgotten()) node.replaceWithText('PlatformProxy');
  }

  const renamedExecBodyNode = execInitializer.getBody();
  const inputSchemaText = inputDeclaration.getText();
  let execBody = simplifyScalarQuerySerialization(
    replaceProxyRequestType(
      sanitizeVendoredSource(
        Node.isBlock(renamedExecBodyNode)
          ? renamedExecBodyNode.getText()
          : `{ return ${renamedExecBodyNode.getText()}; }`,
      ),
      usesProxyRequestType,
    ),
    inputSchemaText,
  );
  if (readsCredentials) {
    execBody = execBody.replace(
      /\bplatformProxy\s*\.\s*getConnection\s*\(\s*\)/g,
      'platformProxy.getConnectionWithCredentials()',
    );
  }

  const moduleStatements = widenResponseEnums(
    source
      .getStatements()
      .filter(statement => shouldKeepStatement(statement, createActionCall))
      .map(statement => replaceProxyRequestType(sanitizeVendoredSource(statement.getText()), usesProxyRequestType)),
    inputSchemaName,
  );

  return {
    kind: 'ok',
    value: {
      candidate,
      description: readStringProperty(argument, 'description') ?? '',
      inputSchemaName,
      outputSchemaName,
      toolFactoryName: `${actionName}Tool`,
      moduleStatements,
      execBody,
      usesProxyRequestType,
    },
  };
}

const DELEGATED_OFFICE_PROVIDER_IDS = new Set(['microsoft-excel', 'microsoft-powerpoint', 'microsoft-word']);

/** Applies `pattern` exactly once, or throws so an upstream template change can't silently drop an override. */
function replaceOnce(
  text: string,
  pattern: RegExp,
  replacement: string,
  action: ExtractedAction,
  what: string,
): string {
  const matches = text.match(new RegExp(pattern.source, `${pattern.flags.replace('g', '')}g`));
  if (matches?.length !== 1) {
    throw new Error(
      `Unable to adapt ${action.candidate.providerId}/${action.candidate.actionSlug} (${what}); the upstream template shape changed.`,
    );
  }
  return text.replace(pattern, replacement);
}

/**
 * The live Fireflies API returns `summary.keywords` as a list of strings and
 * `speakers[].id` as a number, while the template only accepts strings, so
 * reading most real transcripts threw a ZodError (#29401). Accept both shapes
 * from the provider and keep the tool's string output contract, the way the
 * template already treats `action_items` and sentence `speaker_id`. Drop this
 * once the upstream template accepts these shapes.
 */
function adaptFirefliesGetTranscript(action: ExtractedAction): ExtractedAction {
  const fail = (what: string): never => {
    throw new Error(
      `Unable to adapt ${action.candidate.providerId}/${action.candidate.actionSlug} (${what}); the upstream template shape changed.`,
    );
  };
  // Keyed by the top-level declaration each rewrite targets. Every key must
  // match exactly one template statement, so a renamed or removed declaration
  // fails generation instead of silently dropping part of the override.
  const statementRewrites: Readonly<Record<string, (statement: string) => string[]>> = {
    ProviderSummarySchema: statement => [
      replaceOnce(
        statement,
        /(action_items: z\.union\(\[z\.string\(\), z\.array\(z\.string\(\)\)\]\)\.nullish\(\))/,
        '$1,\n    keywords: z.union([z.string(), z.array(z.string())]).nullish()',
        action,
        'summary keywords schema',
      ),
    ],
    SpeakerSchema: statement => [
      statement,
      'const ProviderSpeakerSchema = SpeakerSchema.extend({\n    id: z.union([z.string(), z.number()]).nullish()\n});',
    ],
    TranscriptSchema: statement => [
      replaceOnce(
        statement,
        /speakers: z\.array\(SpeakerSchema\)\.nullish\(\)/,
        'speakers: z.array(ProviderSpeakerSchema).nullish()',
        action,
        'provider speakers schema',
      ),
    ],
    normalizeActionItems: statement => [
      statement,
      "function normalizeKeywords(keywords: string | string[]): string {\n    return Array.isArray(keywords) ? keywords.join(', ') : keywords;\n}",
      'function normalizeSpeaker(speaker: z.infer<typeof ProviderSpeakerSchema>): z.infer<typeof SpeakerSchema> {\n    return { ...speaker, id: speaker.id != null ? String(speaker.id) : speaker.id };\n}',
    ],
  };

  const rewritten = new Map<string, number>();
  const moduleStatements = action.moduleStatements.flatMap(statement => {
    const name = /^(?:const|function) (\w+)\b/.exec(statement)?.[1];
    const rewrite = name !== undefined && Object.hasOwn(statementRewrites, name) ? statementRewrites[name] : undefined;
    if (name === undefined || !rewrite) return [statement];
    rewritten.set(name, (rewritten.get(name) ?? 0) + 1);
    return rewrite(statement);
  });
  for (const name of Object.keys(statementRewrites)) {
    if (rewritten.get(name) !== 1) fail(`${name} declaration`);
  }

  let execBody = replaceOnce(
    action.execBody,
    /(action_items:\s*transcript\.summary\.action_items != null\s*\?\s*normalizeActionItems\(transcript\.summary\.action_items\)\s*:\s*transcript\.summary\.action_items)/,
    '$1,\n                      keywords:\n                          transcript.summary.keywords != null ? normalizeKeywords(transcript.summary.keywords) : transcript.summary.keywords',
    action,
    'summary keywords normalization',
  );
  execBody = replaceOnce(
    execBody,
    /speakers: transcript\.speakers \?\? undefined/,
    'speakers: transcript.speakers ? transcript.speakers.map(normalizeSpeaker) : undefined',
    action,
    'speaker normalization',
  );

  return { ...action, moduleStatements, execBody };
}

/**
 * PostHog's query API returns `types` as `[columnName, clickhouseType]` pairs
 * (ClickHouse `with_column_types`, and `list[tuple[str, str]]` on its direct
 * SQL adapters), while the template declares `string[]`, so every query
 * response carrying column types failed validation (#30528). Accept the pairs
 * in the provider response and the tool output, and check that the exec body
 * still returns `types`. The tuple is strict on purpose: if PostHog changes the
 * shape again, the call fails loudly instead of passing bad metadata through.
 * The description match is exact too, so a template that only rewords that
 * sentence also stops regeneration; that is deliberate, to force a look at the
 * schema whenever this declaration changes.
 * Drop this once the upstream template does.
 */
function adaptPosthogRunQuery(action: ExtractedAction): ExtractedAction {
  const stringTypes = /types: z\.array\(z\.string\(\)\)/;
  const pairTypes = 'types: z.array(z.tuple([z.string(), z.string()]))';
  // Keyed by the declaration each rewrite targets; each must match exactly one
  // statement so a renamed declaration fails generation instead of shipping
  // the string schema.
  const statementRewrites: Readonly<Record<string, (statement: string) => string>> = {
    [action.outputSchemaName]: statement =>
      replaceOnce(
        replaceOnce(statement, stringTypes, pairTypes, action, 'output types schema'),
        /Column types for the result rows\./,
        'Column types as [columnName, clickhouseType] pairs, one per column.',
        action,
        'output types description',
      ),
    ProviderResponseSchema: statement =>
      replaceOnce(statement, stringTypes, pairTypes, action, 'provider types schema'),
  };

  const rewritten = new Set<string>();
  const moduleStatements = action.moduleStatements.map(statement => {
    const name = /^(?:export )?const (\w+)\b/.exec(statement)?.[1];
    const rewrite = name !== undefined && Object.hasOwn(statementRewrites, name) ? statementRewrites[name] : undefined;
    if (name === undefined || !rewrite) return statement;
    rewritten.add(name);
    return rewrite(statement);
  });
  for (const name of Object.keys(statementRewrites)) {
    if (!rewritten.has(name)) {
      throw new Error(
        `Unable to adapt ${action.candidate.providerId}/${action.candidate.actionSlug} (${name} declaration); the upstream template shape changed.`,
      );
    }
  }

  // Identity rewrite used as an assertion: the fixed schemas are useless if the
  // exec body stops returning the parsed `types`.
  const execBody = replaceOnce(
    action.execBody,
    /types: providerResponse\.types,/,
    'types: providerResponse.types,',
    action,
    'output types pass-through',
  );

  return { ...action, moduleStatements, execBody };
}

/**
 * OpenAI retired gpt-image-1 on 2026-10-23, so a call that omits `model` fails
 * against the upstream template's default. Default to OpenAI's recommended
 * replacement instead. Drop this once the upstream template does.
 */
const OPENAI_IMAGE_DEFAULT_MODEL = 'gpt-image-2.5-sunburst';

function adaptOpenAICreateImage(action: ExtractedAction): ExtractedAction {
  const moduleStatements = action.moduleStatements.map(statement =>
    statement.includes(`const ${action.inputSchemaName}`)
      ? replaceOnce(
          statement,
          /Defaults to \\?"gpt-image-1\\?"/,
          `Defaults to \"${OPENAI_IMAGE_DEFAULT_MODEL}\"`,
          action,
          'model default description',
        )
      : statement,
  );
  const execBody = replaceOnce(
    action.execBody,
    /input\.model \?\? 'gpt-image-1'/,
    `input.model ?? '${OPENAI_IMAGE_DEFAULT_MODEL}'`,
    action,
    'model default',
  );
  return { ...action, moduleStatements, execBody };
}

/**
 * GitLab templates build request paths inconsistently: some encode the project,
 * group, or file path, some insert it raw, and some encode a value their schema
 * already documents as URL-encoded. A raw `?` or `#` moves the rest of the path
 * into the query (`project_id: "42?"` turns delete-pipeline into
 * `DELETE /projects/42`), a raw `group/project` adds a path segment, and an
 * encoded `group%2Fproject` passed through `encodeURIComponent` becomes
 * `group%252Fproject`. Project and group identifiers are documented as raw or
 * URL-encoded, so they go through a helper that decodes once and encodes once.
 * Every other segment (branch, file path, tag, sha, numeric ids) is a literal
 * name where `%2F` differs from `/`, so it is encoded as given.
 */
const GITLAB_PATH_SEGMENT_HELPER = `/** Encodes one GitLab path segment exactly once, whether \`value\` arrives raw or already URL-encoded. */
function gitlabPathSegment(value: string | number): string {
  const text = String(value);
  try {
    return encodeURIComponent(decodeURIComponent(text));
  } catch {
    return encodeURIComponent(text);
  }
}`;

/** Endpoint expressions that hold a GitLab project or group id or path (raw or URL-encoded). */
const GITLAB_ID_OR_PATH_EXPRESSIONS = new Set([
  'input.project_id',
  'input.group_id',
  'input.id',
  'projectId',
  'encodedProjectId',
  'groupId',
]);

function stripEncodingWrappers(expression: string): string {
  let core = expression.trim();
  for (;;) {
    const wrapped = /^(?:encodeURIComponent|String)\((.*)\)$/s.exec(core);
    if (!wrapped) return core;
    core = wrapped[1]!.trim();
  }
}

function encodeGitLabPathSegments(action: ExtractedAction): ExtractedAction {
  let rewrites = 0;
  const execBody = action.execBody.replace(/(endpoint:\s*`)([^`]*)`/g, (_match, prefix: string, path: string) => {
    const encoded = path.replace(/\$\{([^{}]*)\}/g, (_segment, expression: string) => {
      rewrites++;
      const value = stripEncodingWrappers(expression);
      return GITLAB_ID_OR_PATH_EXPRESSIONS.has(value)
        ? `\${gitlabPathSegment(${value})}`
        : `\${encodeURIComponent(String(${value}))}`;
    });
    return `${prefix}${encoded}\``;
  });
  if (rewrites === 0) return action;
  return { ...action, moduleStatements: [GITLAB_PATH_SEGMENT_HELPER, ...action.moduleStatements], execBody };
}

interface StatementRewrite {
  pattern: RegExp;
  replacement: string;
  /** Matches expected across all module statements; a different count means the template changed. */
  count: number;
  what: string;
}

function rewriteModuleStatements(action: ExtractedAction, rewrites: readonly StatementRewrite[]): ExtractedAction {
  let moduleStatements = action.moduleStatements;
  for (const { pattern, replacement, count, what } of rewrites) {
    const global = new RegExp(pattern.source, `${pattern.flags.replace('g', '')}g`);
    const found = moduleStatements.reduce((total, statement) => total + (statement.match(global)?.length ?? 0), 0);
    if (found !== count) {
      throw new Error(
        `Unable to adapt ${action.candidate.providerId}/${action.candidate.actionSlug} (${what}); the upstream template shape changed.`,
      );
    }
    moduleStatements = moduleStatements.map(statement => statement.replace(global, replacement));
  }
  return { ...action, moduleStatements };
}

/**
 * A GitLab project or group id or path. Numbers must be exact positive
 * integers (a rounded unsafe integer would address another resource), and
 * strings must be encodable (an unpaired surrogate makes encodeURIComponent
 * throw before the request).
 */
export const GITLAB_ID_OR_PATH_SCHEMA =
  "z.union([z.number().int().positive().max(Number.MAX_SAFE_INTEGER), z.string().min(1).refine(value => { try { encodeURIComponent(value); return true; } catch { return false; } }, 'must not contain unpaired surrogate characters')])";

/**
 * GitLab returns `null`, not an omitted field, for these values, and the
 * templates reject null, so a successful read or write failed validation after
 * GitLab had answered (or acted): a commit with no CI, a release or milestone
 * with no description or dates, a merge request read before GitLab prepared it,
 * a retried job with no user, and pipeline coverage, which GitLab sends as a
 * decimal string. Drop each entry once the upstream template accepts it.
 */
const GITLAB_RESPONSE_SCHEMA_FIXES: Readonly<Record<string, readonly StatementRewrite[]>> = {
  'get-commit': [
    {
      pattern: /last_pipeline: LastPipelineSchema,/,
      replacement: 'last_pipeline: LastPipelineSchema.nullable(),',
      count: 2,
      what: 'nullable last_pipeline',
    },
    {
      pattern: /status: z\.string\(\)\.optional\(\),/,
      replacement: 'status: z.string().nullish(),',
      count: 2,
      what: 'nullable commit status',
    },
  ],
  'get-release': [
    {
      pattern: /(description|due_date|start_date): z\.string\(\)\.optional\(\),/,
      replacement: '$1: z.string().nullish(),',
      count: 4,
      what: 'nullable release and milestone fields',
    },
  ],
  'get-merge-request': [
    { pattern: /\bsha: z\.string\(\),/, replacement: 'sha: z.string().nullable(),', count: 1, what: 'nullable sha' },
    {
      pattern: /prepared_at: z\.string\(\)\.optional\(\),/,
      replacement: 'prepared_at: z.string().nullish(),',
      count: 1,
      what: 'nullable prepared_at',
    },
  ],
  'list-merge-requests': [
    { pattern: /\bsha: z\.string\(\),/, replacement: 'sha: z.string().nullable(),', count: 1, what: 'nullable sha' },
  ],
  'retry-job': [
    {
      pattern: /user: ProviderUserSchema\.optional\(\),/,
      replacement: 'user: ProviderUserSchema.nullish(),',
      count: 1,
      what: 'nullable job user',
    },
  ],
  'cancel-pipeline': [
    {
      pattern: /coverage: z\.number\(\)\.nullable\(\)\.optional\(\),/,
      replacement: 'coverage: z.union([z.number(), z.string()]).nullish(),',
      count: 1,
      what: 'string coverage',
    },
  ],
  'delete-project': [
    {
      pattern: /If true, archive the project instead of permanently deleting it\. Defaults to false\./,
      replacement:
        'If true, archive the project instead of deleting it. Defaults to false, which requests deletion; GitLab.com and instances with delayed deletion keep the project for a retention period before removing it.',
      count: 1,
      what: 'archive description',
    },
  ],
};

/**
 * Templates advertise "delete or archive" on tools that can only delete, so an
 * agent asked to archive a branch, issue, or group could pick a tool that
 * deletes it. delete-project really can archive; it keeps its description.
 */
const GITLAB_DESCRIPTIONS: Readonly<Record<string, string>> = {
  'delete-branch': 'Delete a branch in GitLab.',
  'delete-issue': 'Delete an issue in GitLab.',
  'delete-group':
    'Schedule a group for deletion in GitLab. Pass the numeric group id: GitLab renames the group when it schedules deletion, so a path stops working. To then remove a subgroup permanently, read its renamed full_path with gitlab_get_group and call again with permanently_remove and that full_path; GitLab accepts the removal and completes it asynchronously.',
  'list-jobs': 'List jobs from GitLab, newest first.',
};

/**
 * Input fixes: GitLab's jobs endpoint ignores `order_by` and `sort` (it always
 * returns newest first), and `archived` on project lists filters rather than
 * adding archived projects to the results.
 */
const GITLAB_INPUT_FIXES: Readonly<Record<string, readonly StatementRewrite[]>> = {
  'list-jobs': [
    {
      pattern: /\n\s*order_by: z\.string\(\)\.optional\(\)\.describe\([^\n]*\),?/,
      replacement: '',
      count: 1,
      what: 'order_by',
    },
    {
      pattern: /\n\s*sort: z\.string\(\)\.optional\(\)\.describe\([^\n]*\),?/,
      replacement: '',
      count: 1,
      what: 'sort',
    },
  ],
  'get-file': [
    {
      pattern: /file_path: z\.string\(\)\.describe\('URL-encoded full path to the file\. Example: hello\.txt'\)/,
      replacement: `file_path: z.string().describe('Full path to the file, not URL-encoded (a %2F stays literally in the name). Example: "src/app.ts"')`,
      count: 1,
      what: 'file_path description',
    },
  ],
  'update-file': [
    {
      pattern: /file_path: z\.string\(\)\.describe\('URL-encoded full path to the file\. Example: hello\.txt'\)/,
      replacement: `file_path: z.string().describe('Full path to the file, not URL-encoded (a %2F stays literally in the name). Example: "src/app.ts"')`,
      count: 1,
      what: 'file_path description',
    },
  ],
  'delete-group': [
    {
      pattern: /\.describe\('If true, immediately deletes a subgroup already marked for deletion\.'\)/,
      replacement:
        ".describe('If true, request permanent removal of a subgroup already scheduled for deletion. GitLab completes it asynchronously.')",
      count: 1,
      what: 'permanently_remove description',
    },
    {
      pattern: /\bgroup_id: z\.union\(\[z\.number\(\), z\.string\(\)\]\)(?=\.describe)/,
      replacement: `group_id: ${GITLAB_ID_OR_PATH_SCHEMA}`,
      count: 1,
      what: 'group id',
    },
    {
      pattern: /\.describe\('The full path to the subgroup\. Required when permanently_remove is true\.'\)/,
      replacement:
        ".describe('The subgroup full_path after it was scheduled for deletion (GitLab renames it). Read it with gitlab_get_group using the numeric id. Required when permanently_remove is true.')",
      count: 1,
      what: 'full_path description',
    },
  ],
  'delete-project': [
    {
      pattern: /(\n\s*)archived: z\.boolean\(\),(\s*message)/,
      replacement:
        "$1archived: z.boolean().describe('true when this call archived the project, false when it requested deletion. Not the project archive state.'),$2",
      count: 1,
      what: 'archived output description',
    },
  ],
  'get-group': [
    {
      pattern:
        /\bid: z\.union\(\[z\.string\(\), z\.number\(\)\]\)(?=\.describe\('The ID or URL-encoded path of the group)/,
      replacement: `id: ${GITLAB_ID_OR_PATH_SCHEMA}`,
      count: 1,
      what: 'group id',
    },
  ],
  'update-group': [
    {
      // GitLab takes a group path here too, like get_group and delete_group.
      pattern: /(updateGroupInputSchema = z\.object\(\{\s*)id: z\.number\(\)/,
      replacement: `$1id: ${GITLAB_ID_OR_PATH_SCHEMA}`,
      count: 1,
      what: 'group id',
    },
    {
      pattern: /two_factor_grace_period: z(\s*)\.number\(\)(?=\s*\.optional\(\)\s*\.describe)/,
      replacement: 'two_factor_grace_period: z$1.number().int().nonnegative()',
      count: 1,
      what: 'two_factor_grace_period bound',
    },
  ],
  'update-project': [
    {
      pattern: /(updateProjectInputSchema = z\.object\(\{\s*)id: z\.union\(\[z\.number\(\), z\.string\(\)\]\)/,
      replacement: `$1id: ${GITLAB_ID_OR_PATH_SCHEMA}`,
      count: 1,
      what: 'project id',
    },
    {
      // A new, empty project has no default branch yet.
      pattern: /default_branch: z\.string\(\)\.optional\(\),/,
      replacement: 'default_branch: z.string().nullish(),',
      count: 2,
      what: 'nullable default_branch',
    },
  ],
  'create-commit': [
    {
      pattern: /start_project: z\.string\(\)\.optional\(\)/,
      replacement: `start_project: ${GITLAB_ID_OR_PATH_SCHEMA}.optional()`,
      count: 1,
      what: 'start_project id',
    },
    {
      // GitLab rejects these after the request; check them before it.
      pattern: /(const CommitActionSchema = z\.object\(\{[\s\S]*?\n\}\))(;)/,
      replacement:
        "$1.superRefine((value, ctx) => { const missing = (value.action === 'create' || value.action === 'update') && value.content === undefined ? 'content' : value.action === 'move' && value.previous_path === undefined ? 'previous_path' : value.action === 'chmod' && value.execute_filemode === undefined ? 'execute_filemode' : undefined; if (missing) ctx.addIssue({ code: 'custom', path: [missing], message: `${missing} is required for a ${value.action} action` }); })$2",
      count: 1,
      what: 'per-action fields',
    },
  ],
  'create-release': [
    {
      // GitLab creates the tag before it rejects duplicate links, leaving an orphan tag.
      pattern: /assets_links: z\.array\(AssetLinkInputSchema\)\.optional\(\)/,
      replacement:
        "assets_links: z.array(AssetLinkInputSchema).refine(links => new Set(links.map(link => link.name)).size === links.length && new Set(links.map(link => link.url)).size === links.length, 'asset link names and URLs must be unique').optional()",
      count: 1,
      what: 'unique asset links',
    },
  ],
  'update-merge-request': [
    {
      pattern: /(export const updateMergeRequestInputSchema = [\s\S]*?)(;\s*)$/,
      replacement:
        "$1.refine(data => data.milestone_id === undefined || data.milestone === undefined, { message: 'Pass milestone_id or milestone, not both.', path: ['milestone'] })$2",
      count: 1,
      what: 'milestone exclusivity',
    },
  ],
  'list-projects': [
    {
      pattern: /archived: z\.boolean\(\)\.optional\(\)\.describe\('Include archived projects\.'\)/,
      replacement:
        "archived: z.boolean().optional().describe('true returns only archived projects, false only active ones. Omit to return both.')",
      count: 1,
      what: 'archived description',
    },
  ],
};

/**
 * Templates type `project_id` as a number in some tools and a string in others,
 * so an id or path one tool returns can be rejected by the next. Every GitLab
 * input accepts both; `gitlabPathSegment` turns either into one path segment.
 */
const GITLAB_PROJECT_ID_DESCRIPTION =
  'Numeric project ID, or the project path raw or URL-encoded. Example: 82599306, "team/app", or "team%2Fapp"';

function acceptGitLabProjectIdOrPath(action: ExtractedAction): ExtractedAction {
  const moduleStatements = action.moduleStatements.map(statement =>
    /export const \w+InputSchema = z\b/.test(statement)
      ? statement.replace(
          /project_id: z(\s*)\.(?:number\(\)|string\(\)|union\(\[[^\]]*\]\))(?:(\s*)\.describe\((['"])(?:\\.|(?!\3).)*\3\))?/g,
          (_match, space: string, describeSpace: string | undefined) =>
            `project_id: ${GITLAB_ID_OR_PATH_SCHEMA.replace(/^z/, `z${space}`)}${describeSpace ?? ''}.describe(${JSON.stringify(GITLAB_PROJECT_ID_DESCRIPTION)})`,
        )
      : statement,
  );
  // delete-project echoes the input id in a string output field.
  const execBody = action.execBody.replace(
    /\bproject_id: input\.project_id,/g,
    'project_id: String(input.project_id),',
  );
  return { ...action, moduleStatements, execBody };
}

/**
 * The proxy replays PUT and DELETE after a transient 5xx, so a GitLab write the
 * first attempt already applied could run again: deleting a branch recreated
 * by someone else meanwhile, committing a file change twice, or undoing a
 * concurrent group setting. GitLab writes get exactly one attempt; reads keep
 * the template's retries.
 */
function attemptGitLabWritesOnce(action: ExtractedAction): ExtractedAction {
  if (/platformProxy\.get\(/.test(action.execBody)) return action;
  return { ...action, execBody: action.execBody.replace(/retries: \d+/g, 'retries: 1') };
}

/** Identifier fields of each GitLab update tool; any other field counts as an update. */
const GITLAB_UPDATE_IDENTIFIERS: Readonly<Record<string, readonly string[]>> = {
  'update-group': ['id'],
  'update-issue': ['project_id', 'issue_iid'],
  'update-project': ['id'],
  'update-release': ['project_id', 'tag_name'],
};

/** Rejects an update call with no field to change (false, 0, and "" count as values). */
function requireGitLabUpdateField(action: ExtractedAction, identifiers: readonly string[]): ExtractedAction {
  let rewrites = 0;
  const moduleStatements = action.moduleStatements.map(statement => {
    if (!/^export const \w+InputSchema = /.test(statement)) return statement;
    rewrites++;
    return statement.replace(
      /;\s*$/,
      `.refine(data => Object.entries(data).some(([key, value]) => !${JSON.stringify(identifiers)}.includes(key) && value !== undefined), { message: 'Provide at least one field to update.' });`,
    );
  });
  if (rewrites !== 1)
    throw new Error(
      `Unable to adapt gitlab/${action.candidate.actionSlug} (update field); the upstream template shape changed.`,
    );
  return { ...action, moduleStatements };
}

const GITLAB_NEXT_PAGE_HELPER = `/** Fills x-next-page from the Link header when GitLab sends only Link (keyset pagination, large result sets). */
function fillGitLabNextPage(headers: Record<string, string>): void {
  if (headers['x-next-page']) return;
  const next = /<([^>]+)>;\\s*rel="next"/.exec(headers['link'] ?? '')?.[1];
  const page = next ? new URL(next).searchParams.get('page') : null;
  if (page) headers['x-next-page'] = page;
}`;

/**
 * GitLab list cursors are page numbers. Templates validate them inline (or
 * not at all), so a cursor like "2junk" reaches GitLab as page 2 or throws
 * mid-request. Constrain the cursor in the schema, and fall back to the Link
 * header for the next page.
 */
function paginateGitLabList(action: ExtractedAction): ExtractedAction {
  const moduleStatements = action.moduleStatements.map(statement =>
    /^export const \w+InputSchema = /.test(statement)
      ? statement.replace(
          /cursor: z(\s*)\.string\(\)/,
          "cursor: z$1.string().regex(/^[1-9]\\d*$/, 'cursor must be the page number from next_cursor')",
        )
      : statement,
  );
  const execBody = replaceOnce(
    action.execBody,
    /(const response = await platformProxy\.get\((?:config|\{[\s\S]*?\})\);\n)/,
    '$1      fillGitLabNextPage(response.headers);\n',
    action,
    'next page fallback',
  );
  if (moduleStatements.join('\n') === action.moduleStatements.join('\n')) {
    throw new Error(
      `Unable to adapt gitlab/${action.candidate.actionSlug} (cursor); the upstream template shape changed.`,
    );
  }
  return { ...action, moduleStatements: [GITLAB_NEXT_PAGE_HELPER, ...moduleStatements], execBody };
}

function adaptGitLabAction(action: ExtractedAction): ExtractedAction {
  const slug = action.candidate.actionSlug;
  let adapted = attemptGitLabWritesOnce(acceptGitLabProjectIdOrPath(encodeGitLabPathSegments(action)));
  const schemaFixes = [...(GITLAB_RESPONSE_SCHEMA_FIXES[slug] ?? []), ...(GITLAB_INPUT_FIXES[slug] ?? [])];
  if (schemaFixes.length > 0) adapted = rewriteModuleStatements(adapted, schemaFixes);
  const updateIdentifiers = GITLAB_UPDATE_IDENTIFIERS[slug];
  if (updateIdentifiers) adapted = requireGitLabUpdateField(adapted, updateIdentifiers);
  if (slug.startsWith('list-')) adapted = paginateGitLabList(adapted);
  if (slug === 'get-branch') {
    // A deleted connection also arrives as a 404; don't relabel it "Branch not found".
    adapted = {
      ...adapted,
      execBody: replaceOnce(
        adapted.execBody,
        /error\.response\.status === 404/,
        "error.response.status === 404 &&\n          !('code' in error && error.code === 'connection_not_found')",
        adapted,
        'connection_not_found passthrough',
      ),
    };
  }
  if (slug === 'list-jobs') {
    // GitLab reads several statuses only as `scope[]`; repeated bare `scope` keys keep just one.
    let execBody = replaceOnce(
      adapted.execBody,
      /\{ scope: input\.scope \}/,
      "{ 'scope[]': input.scope }",
      adapted,
      'scope array',
    );
    execBody = replaceOnce(execBody, /\n *\.\.\.\(input\.order_by !== undefined[^\n]*/, '', adapted, 'order_by param');
    execBody = replaceOnce(execBody, /\n *\.\.\.\(input\.sort !== undefined[^\n]*/, '', adapted, 'sort param');
    adapted = { ...adapted, execBody };
  }
  if (slug === 'get-group') {
    // The tool returns group metadata only; skip the project lists GitLab embeds by default.
    adapted = {
      ...adapted,
      execBody: replaceOnce(
        adapted.execBody,
        /(endpoint: `\/api\/v4\/groups\/\$\{gitlabPathSegment\(input\.id\)\}`,)/,
        '$1\n        params: { with_projects: false },',
        adapted,
        'with_projects',
      ),
    };
  }
  if (slug === 'delete-project') {
    adapted = {
      ...adapted,
      execBody: replaceOnce(
        adapted.execBody,
        /'Project deleted successfully\.'/,
        "'GitLab accepted the deletion request. GitLab.com and instances with delayed deletion keep the project for a retention period before removing it.'",
        adapted,
        'deletion message',
      ),
    };
  }
  const description = GITLAB_DESCRIPTIONS[slug];
  return description ? { ...adapted, description } : adapted;
}

function applyProviderActionOverrides(action: ExtractedAction): ExtractedAction {
  if (action.candidate.providerId === 'gitlab') {
    return adaptGitLabAction(action);
  }
  if (action.candidate.providerId === 'openai' && action.candidate.actionSlug === 'create-image') {
    return adaptOpenAICreateImage(action);
  }
  if (action.candidate.providerId === 'fireflies' && action.candidate.actionSlug === 'get-transcript') {
    return adaptFirefliesGetTranscript(action);
  }
  if (action.candidate.providerId === 'posthog' && action.candidate.actionSlug === 'run-query') {
    return adaptPosthogRunQuery(action);
  }
  if (DELEGATED_OFFICE_PROVIDER_IDS.has(action.candidate.localId) && action.candidate.actionSlug === 'get-user-drive') {
    return adaptDelegatedGetUserDrive(action);
  }
  if (action.candidate.localId === 'microsoft-excel' && action.candidate.actionSlug === 'delete-workbook') {
    return bypassSharedLockOnDelete(action);
  }
  return action;
}

// The Excel workbook tools write through sessionless workbook API calls, which leave a shared lock on the
// file that can last 30 minutes; without this header, deleting a workbook the agent just edited fails with 423.
// https://learn.microsoft.com/en-us/graph/api/driveitem-delete
function bypassSharedLockOnDelete(action: ExtractedAction): ExtractedAction {
  const execBody = action.execBody.replace(
    /(await platformProxy\.delete\(\{\s*endpoint:[^\n]*\n)/,
    "$1headers: { Prefer: 'bypass-shared-lock' },\n",
  );
  if (execBody === action.execBody) {
    throw new Error(
      `Unable to add the shared-lock bypass to ${action.candidate.providerId}/${action.candidate.actionSlug}; the upstream template shape changed.`,
    );
  }
  return { ...action, execBody };
}

// Nango shares these actions with client-credentials templates. Adapt only the
// customer-facing delegated providers; keep the explicit -oauth2-cc variants unchanged.
function adaptDelegatedGetUserDrive(action: ExtractedAction): ExtractedAction {
  let inputSchemaUpdated = false;
  const moduleStatements = action.moduleStatements.map(statement => {
    if (!statement.includes(`const ${action.inputSchemaName}`)) return statement;

    const updated = statement.replace('userId: z.string().describe(', 'userId: z.string().min(1).optional().describe(');
    inputSchemaUpdated ||= updated !== statement;
    return updated;
  });

  const endpointPattern = /endpoint:\s*`\/v1\.0\/users\/\$\{encodeURIComponent\(input\.userId\)\}\/drive`/;
  const execBody = action.execBody.replace(
    endpointPattern,
    "endpoint: input.userId ? `/v1.0/users/${encodeURIComponent(input.userId)}/drive` : '/v1.0/me/drive'",
  );

  if (!inputSchemaUpdated || execBody === action.execBody) {
    throw new Error(
      `Unable to adapt ${action.candidate.providerId}/${action.candidate.actionSlug} for delegated OAuth; the upstream template shape changed.`,
    );
  }

  return {
    ...action,
    description: "Get the connected user's OneDrive, or another user's drive when userId is provided.",
    moduleStatements,
    execBody,
  };
}

/**
 * Exec bodies are normalized to a block during extraction; strip the outer
 * braces so the vendored statements inline directly into `execute` after the
 * request-context binding (prettier re-indents the emitted file).
 */
function execBodyStatements(execBody: string): string {
  return execBody.trim().replace(/^\{/, '').replace(/\}$/, '').trim();
}

function modelOutputOverride(action: ExtractedAction): { importStatement: string; toolProperty: string } | undefined {
  if (action.candidate.providerId !== 'openai' || action.candidate.actionSlug !== 'create-image') return undefined;

  return {
    importStatement: "import { toImageGenerationModelOutput } from '../../../runtime/model-output.js';",
    toolProperty: '    toModelOutput: toImageGenerationModelOutput,',
  };
}

/**
 * Top-level response fields that must not leave a generated tool. The upstream
 * template returns them because the provider does, but an agent has no use for
 * a credential and must not see one.
 */
const OUTPUT_SECRET_FIELDS: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = {
  // GET /v1/user echoes the account's raw API key; the masked xi_api_key_preview stays.
  elevenlabs: {
    'get-user': ['xi_api_key'],
  },
  // GitLab returns the project's runner registration token to maintainers.
  gitlab: {
    'create-project': ['runners_token'],
    'get-project': ['runners_token'],
  },
  resend: {
    'create-webhook': ['signing_secret'],
    'get-webhook': ['signing_secret'],
  },
};

function outputSecretFields(action: ExtractedAction): readonly string[] | undefined {
  const provider = Object.prototype.hasOwnProperty.call(OUTPUT_SECRET_FIELDS, action.candidate.providerId)
    ? OUTPUT_SECRET_FIELDS[action.candidate.providerId]
    : undefined;
  if (!provider) return undefined;
  const fields = Object.prototype.hasOwnProperty.call(provider, action.candidate.actionSlug)
    ? provider[action.candidate.actionSlug]
    : undefined;
  return fields && fields.length > 0 ? fields : undefined;
}

/**
 * Input fields whose values a template uses as a raw proxy endpoint, mapped to
 * the pattern a legitimate value must match. Graph list templates follow the
 * `@odata.nextLink` cursor verbatim; without a check an agent could pass any
 * Graph path the connection's token can reach. Each pattern pins the cursor to
 * the endpoint the tool itself lists, and requires the `?` right after it so
 * the path portion can't be extended. Keyed by `<providerId>/<actionSlug>`.
 */
const INPUT_FIELD_PATTERNS = new Map<string, Readonly<Record<string, { pattern: RegExp; message: string }>>>([
  [
    'microsoft-excel-oauth2-cc/list-users',
    {
      cursor: {
        pattern: /^https:\/\/graph\.microsoft\.com\/v1\.0\/users\?/,
        message: 'cursor must be the nextCursor returned by a previous list_users call',
      },
    },
  ],
  [
    'microsoft-excel/list-users',
    {
      cursor: {
        pattern: /^https:\/\/graph\.microsoft\.com\/v1\.0\/users\?/,
        message: 'cursor must be the nextCursor returned by a previous list_users call',
      },
    },
  ],
  [
    'microsoft-excel-oauth2-cc/list-sites',
    {
      cursor: {
        pattern: /^https:\/\/graph\.microsoft\.com\/v1\.0\/sites\?/,
        message: 'cursor must be the nextCursor returned by a previous list_sites call',
      },
    },
  ],
  [
    'microsoft-excel/list-sites',
    {
      cursor: {
        pattern: /^https:\/\/graph\.microsoft\.com\/v1\.0\/sites\?/,
        message: 'cursor must be the nextCursor returned by a previous list_sites call',
      },
    },
  ],
  [
    'microsoft-excel-oauth2-cc/list-workbooks',
    {
      cursor: {
        // Graph may percent-encode the quotes around the search term.
        pattern: /^https:\/\/graph\.microsoft\.com\/v1\.0\/drives\/[^/?#]+\/root\/search\(q=[^/?#]*\)\?/,
        message: 'cursor must be the nextCursor returned by a previous list_workbooks call',
      },
    },
  ],
  [
    'microsoft-excel/list-workbooks',
    {
      cursor: {
        // Graph may percent-encode the quotes around the search term.
        pattern: /^https:\/\/graph\.microsoft\.com\/v1\.0\/drives\/[^/?#]+\/root\/search\(q=[^/?#]*\)\?/,
        message: 'cursor must be the nextCursor returned by a previous list_workbooks call',
      },
    },
  ],
]);

function emitActionFile(action: ExtractedAction, pin: TemplatePin): string {
  const proxyTypeImports = [action.usesProxyRequestType ? 'PlatformProxyRequest' : undefined].filter(
    (name): name is string => Boolean(name),
  );
  const proxyImport = `import type { PlatformProxy${proxyTypeImports.length > 0 ? `, ${proxyTypeImports.join(', ')}` : ''} } from '../../../runtime/platform-proxy.js';\n`;
  const modelOutput = modelOutputOverride(action);
  const secretFields = outputSecretFields(action);
  const redactImport = secretFields ? "import { withoutSecretFields } from '../../../runtime/redact.js';\n" : '';
  const redactedSchemaName = `${action.outputSchemaName}Redacted`;
  // `.omit` rejects keys the schema doesn't declare. An undeclared secret can
  // still arrive through `.passthrough()`; `withoutSecretFields` removes it from
  // the result either way, so only declared fields need dropping from the schema.
  const declaredSecretFields = (secretFields ?? []).filter(field =>
    action.moduleStatements.some(statement => new RegExp(`\\b${escapeRegExp(field)}:`).test(statement)),
  );
  const omitKeys = declaredSecretFields.map(field => `${JSON.stringify(field)}: true`).join(', ');
  const redactedSchema = secretFields
    ? `\n/** Provider secrets removed before the result leaves the tool. */\nexport const ${redactedSchemaName} = ${
        declaredSecretFields.length > 0 ? `${action.outputSchemaName}.omit({ ${omitKeys} })` : action.outputSchemaName
      };\n`
    : '';
  const outputSchemaName = secretFields ? redactedSchemaName : action.outputSchemaName;
  const fieldPatterns = Object.entries(
    INPUT_FIELD_PATTERNS.get(`${action.candidate.providerId}/${action.candidate.actionSlug}`) ?? {},
  );
  const checkedInputSchemaName = `${action.inputSchemaName}Checked`;
  // Each pinned field is re-declared as `string().regex(...)` (not an object
  // `.refine`) so the pattern lands in the JSON schema the model sees.
  const checkedInputSchema =
    fieldPatterns.length > 0
      ? `\n/** Values the tool follows as a raw endpoint are pinned to the endpoint it lists. */\nexport const ${checkedInputSchemaName} = ${action.inputSchemaName}.extend({\n${fieldPatterns
          .map(([field, { pattern, message }]) => {
            const original = `${action.inputSchemaName}.shape[${JSON.stringify(field)}]`;
            return `  ${JSON.stringify(field)}: ${original}.unwrap().regex(${pattern.toString()}, ${JSON.stringify(message)}).optional().describe(${original}.description ?? ''),\n`;
          })
          .join('')}});\n`
      : '';
  const inputSchemaName = fieldPatterns.length > 0 ? checkedInputSchemaName : action.inputSchemaName;
  const execute = secretFields
    ? `    execute: async (input, { requestContext }): Promise<z.infer<typeof ${redactedSchemaName}>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const result = await (async (): Promise<z.infer<typeof ${action.outputSchemaName}>> => {
${execBodyStatements(action.execBody)}
      })();
      return withoutSecretFields(result, [${(secretFields ?? []).map(field => JSON.stringify(field)).join(', ')}]);
    },`
    : `    execute: async (input, { requestContext }): Promise<z.infer<typeof ${action.outputSchemaName}>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
${execBodyStatements(action.execBody)}
    },`;

  return `// AUTO-GENERATED from ${pin.repo} @ ${pin.sha.slice(0, 12)} — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

${modelOutput ? `${modelOutput.importStatement}\n` : ''}${proxyImport}${redactImport}
${action.moduleStatements.join('\n\n')}
${redactedSchema}${checkedInputSchema}
export function ${action.toolFactoryName}(proxy: PlatformProxy) {
  return createTool({
    id: '${action.candidate.toolKey}',
    description: ${JSON.stringify(action.description)},
    inputSchema: ${inputSchemaName},
    outputSchema: ${outputSchemaName},
${modelOutput ? `${modelOutput.toolProperty}\n` : ''}${execute}
  });
}
`;
}

function emitToolsFile(integrationId: string, actions: ExtractedAction[], pin: TemplatePin): string {
  const imports = actions
    .map(action => `import { ${action.toolFactoryName} } from './tools/${action.candidate.actionSlug}.js';`)
    .join('\n');
  // Keys are quoted because a leading-digit local ID (e.g. '1password')
  // produces tool keys that are not valid bare identifiers; prettier strips
  // the quotes again wherever they are unnecessary.
  const toolEntries = actions
    .map(action => `    '${action.candidate.toolKey}': ${action.toolFactoryName}(platformProxy),`)
    .join('\n');

  return `// AUTO-GENERATED from ${pin.repo} @ ${pin.sha.slice(0, 12)} — do not edit by hand.
import { createPlatformProxy } from '../../runtime/platform-proxy.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyToolFilter } from '../../toolset.js';
${imports}

export function create${toPascal(integrationId)}Tools(options?: ProviderToolsOptions) {
  const platformProxy = createPlatformProxy({ connectionId: options?.connectionId, client: options?.client });
  const tools = {
${toolEntries}
  };
  return applyToolFilter(tools, { allowTools: options?.allowTools, disallowTools: options?.disallowTools });
}
`;
}

function emitIndexFile(integrationId: string, pin: TemplatePin): string {
  const envVar = providerConnectionEnvVar(integrationId);
  const factoryName = `create${toPascal(integrationId)}Tools`;
  // Shared with updateProviderIndex so the emitted export always matches the
  // import the provider index writes (including leading-digit normalization).
  const registrationName = providerRegistrationName(integrationId);
  return `// AUTO-GENERATED from ${pin.repo} @ ${pin.sha.slice(0, 12)} — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { ${factoryName} } from './tools.js';

export const ${registrationName}: ProviderRegistration = {
  integrationId: '${integrationId}',
  envVar: '${envVar}',
  createTools: ${factoryName},
};

export { ${factoryName} };
`;
}

export interface GenerateProviderOptions {
  providerId: string;
  localId?: string;
  expectedTemplateSha?: string;
}

export interface GenerateProviderResult {
  providerId: string;
  localId: string;
  toolCount: number;
  skippedActions: ProviderManifest['skippedActions'];
}

export async function generateProvider({
  providerId,
  localId = providerId,
  expectedTemplateSha,
}: GenerateProviderOptions): Promise<GenerateProviderResult> {
  validateProviderId(providerId, 'Provider ID');
  validateProviderId(localId, 'Local ID');
  assertProviderEnvVarAvailable(localId);
  const pin = templatePinFor(providerId);
  const expectedSha = expectedTemplateSha ?? pin.sha;

  const actionDir = templatePath(providerId, 'actions');
  if (!actionDir) {
    throw new Error(`Unknown provider '${providerId}'. No actions directory exists in the template checkout.`);
  }

  const templateSha = currentTemplateSha();
  if (templateSha !== expectedSha) {
    throw new Error(
      `Template checkout is at ${templateSha}, but the generator expects ${expectedSha}. Run \`pnpm sync-templates ${providerId}\`.`,
    );
  }

  const project = new Project({ useInMemoryFileSystem: false, skipAddingFilesFromTsConfig: true });
  const extracted: ExtractedAction[] = [];
  const skipped: SkippedAction[] = [];

  for (const filename of readdirSync(actionDir)
    .filter(filename => filename.endsWith('.ts'))
    .sort()) {
    const actionSlug = filename.replace(/\.ts$/, '');
    const file = templatePath(providerId, 'actions', filename);
    if (!file) {
      throw new Error(`Action template '${providerId}/actions/${filename}' resolves outside the template checkout.`);
    }
    const candidate: ActionCandidate = {
      providerId,
      localId,
      file,
      actionSlug,
      toolKey: `${localId.replace(/-/g, '_')}_${toSnake(actionSlug)}`,
    };
    const result = extractAction(project, candidate);
    if (result.kind === 'ok') extracted.push(applyProviderActionOverrides(result.value));
    else skipped.push({ candidate, reason: result.reason });
  }

  if (extracted.length === 0) {
    const reasons = skipped.map(action => `${action.candidate.actionSlug}: ${action.reason}`).join('; ');
    throw new Error(`No usable actions found for '${providerId}'. ${reasons}`);
  }

  const outputDir = providerDir(localId);
  const temporaryDir = resolve(providersDir, `.${localId}.generate-${process.pid}`);
  rmSync(temporaryDir, { recursive: true, force: true });
  mkdirSync(resolve(temporaryDir, 'tools'), { recursive: true });

  try {
    for (const action of extracted) {
      writeFileSync(resolve(temporaryDir, 'tools', `${action.candidate.actionSlug}.ts`), emitActionFile(action, pin));
    }
    writeFileSync(resolve(temporaryDir, 'tools.ts'), emitToolsFile(localId, extracted, pin));
    writeFileSync(resolve(temporaryDir, 'index.ts'), emitIndexFile(localId, pin));
    await formatGeneratedFiles(temporaryDir);

    const manifest: ProviderManifest = {
      providerId,
      localId,
      templateSha,
      templateRepo: pin.repo,
      generatedAt: new Date().toISOString(),
      toolCount: extracted.length,
      skippedActions: skipped.map(action => ({ action: action.candidate.actionSlug, reason: action.reason })),
      files: calculateFileChecksums(temporaryDir),
    };
    writeFileSync(resolve(temporaryDir, '.manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

    rmSync(outputDir, { recursive: true, force: true });
    renameSync(temporaryDir, outputDir);
  } catch (error) {
    rmSync(temporaryDir, { recursive: true, force: true });
    throw error;
  }

  return {
    providerId,
    localId,
    toolCount: extracted.length,
    skippedActions: skipped.map(action => ({ action: action.candidate.actionSlug, reason: action.reason })),
  };
}

function parseArguments(argv: string[]): GenerateProviderOptions {
  const providerId = argv[0];
  if (!providerId) usage();
  let localId: string | undefined;

  for (let index = 1; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === '--as') {
      localId = argv[++index];
      if (!localId) usage();
    } else {
      usage();
    }
  }
  return { providerId, localId };
}

async function main(): Promise<void> {
  try {
    const result = await generateProvider(parseArguments(process.argv.slice(2)));
    console.log(
      `✓ Generated ${result.providerId} as ${result.localId} (${result.toolCount} tools, ${result.skippedActions.length} skipped)`,
    );
    for (const skippedAction of result.skippedActions) {
      console.log(`  - ${skippedAction.action}: ${skippedAction.reason}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main();
}
