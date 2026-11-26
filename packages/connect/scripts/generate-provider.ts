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
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Node, Project, SyntaxKind, VariableDeclarationKind } from 'ts-morph';
import type { CallExpression, ImportDeclaration, ObjectLiteralExpression, SourceFile, Statement } from 'ts-morph';
import { format, resolveConfig } from 'prettier';

import {
  assertProviderEnvVarAvailable,
  calculateFileChecksums,
  currentTemplateSha,
  listHandwrittenFiles,
  providerConnectionEnvVar,
  providerDir,
  providerRegistrationName,
  readManifestIn,
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

/**
 * Some templates declare `output` inline (e.g. `output: z.null()` for a
 * delete). Hoist it into a top-level schema declaration so it gets the same
 * naming and export treatment as declared schemas.
 */
function hoistInlineOutputSchema(source: SourceFile, argument: ObjectLiteralExpression): void {
  const property = argument.getProperty('output');
  if (!property || !Node.isPropertyAssignment(property)) return;
  const initializer = property.getInitializer();
  if (!initializer || !Node.isCallExpression(initializer)) return;
  let name = 'OutputSchema';
  while (source.getVariableDeclaration(name)) name = `Inline${name}`;
  const actionStatement = argument.getFirstAncestorOrThrow(
    ancestor => Node.isStatement(ancestor) && ancestor.getParent() === source,
  );
  source.insertVariableStatement(actionStatement.getChildIndex(), {
    declarationKind: VariableDeclarationKind.Const,
    declarations: [{ name, initializer: initializer.getText() }],
  });
  property.setInitializer(name);
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

  hoistInlineOutputSchema(source, argument);
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
  // Walk property accesses rather than matching text, so a comment such as a
  // `docs.nango.dev` link isn't mistaken for a call to a `dev` helper.
  for (const access of execBodyNode.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)) {
    if (access.getExpression().getText() === 'nango') usedContextMethods.add(access.getName());
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
      "Parameters<ReturnType<typeof createAction>['exec']>[0]",
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
 * The proxy replays PUT and DELETE after a transient 5xx, so a write the first
 * attempt already applied could run again: deleting a GitLab branch recreated by
 * someone else meanwhile, committing a file change twice, or reapplying a Zendesk
 * ticket update over a concurrent one. Writes get exactly one attempt; reads keep
 * the template's retries.
 */
/** Rewrites expected in the exec body; a different count means the template changed. */
function rewriteExecBody(action: ExtractedAction, rewrites: readonly StatementRewrite[]): ExtractedAction {
  let execBody = action.execBody;
  for (const { pattern, replacement, count, what } of rewrites) {
    const global = new RegExp(pattern.source, `${pattern.flags.replace('g', '')}g`);
    if ((execBody.match(global)?.length ?? 0) !== count) {
      throw new Error(
        `Unable to adapt ${action.candidate.providerId}/${action.candidate.actionSlug} (${what}); the upstream template shape changed.`,
      );
    }
    execBody = execBody.replace(global, replacement);
  }
  return { ...action, execBody };
}

/** Zendesk sends `null` for the cursor on the edge pages; the templates reject null. */
const ZENDESK_NULL_CURSORS: StatementRewrite = {
  pattern: /(after_cursor|before_cursor): z\.string\(\)\.optional\(\)/,
  replacement: '$1: z.string().nullish()',
  count: 0,
  what: 'nullable cursors',
};

/** Asks for cursor pages even when the caller gives no page size; Zendesk only sends cursors then. */
const ZENDESK_ALWAYS_CURSOR_PAGES: StatementRewrite = {
  pattern: /if \(input\.per_page !== undefined\) \{\s*params\['page\[size\]'\] = input\.per_page;\s*\}/,
  replacement: "params['page[size]'] = input.per_page ?? 100;",
  count: 1,
  what: 'cursor pages',
};

/** A next cursor only while Zendesk says more results remain. */
function zendeskNextCursor(source: string, pattern: RegExp): StatementRewrite {
  return {
    pattern,
    replacement: `...(${source}.meta?.has_more && ${source}.meta.after_cursor && { next_cursor: ${source}.meta.after_cursor })`,
    count: 1,
    what: 'next cursor',
  };
}

interface ProviderActionFixes {
  statements?: readonly StatementRewrite[];
  exec?: readonly StatementRewrite[];
}

/**
 * Corrections to the Zendesk templates, each found reviewing the toolset:
 * - Cursor pagination answers `null` cursors at either end, which the
 *   templates reject, and a cursor is only a continuation while `has_more`.
 * - Multi-select custom fields hold arrays of option tags, and `null` clears a
 *   field; the update template rejected both, and rejected the ticket Zendesk
 *   returned after the update had already been applied.
 * - Help Center content tag ids are strings, so article reads failed.
 * - Setting a user's organization replaces all their memberships.
 * - Comments and macros fall back to offset pages unless `page[size]` is
 *   sent, and the templates only read cursors, so the default listing never
 *   offered a next page; macros never read the cursor Zendesk answered with.
 * - A section or category article listing ignored the requested locale.
 * - get_ticket fetched the requested sideloads and dropped them, and rejected
 *   a ticket with no group.
 * - An unscoped search mixed users and organizations into the ticket counts
 *   and pages; the search is now limited to tickets, and a ticket it cannot
 *   read is an error rather than silently missing from a counted page.
 * Drop an entry once the upstream template is fixed.
 */
const ZENDESK_FIXES: Readonly<Record<string, ProviderActionFixes>> = {
  'get-article': {
    statements: [
      {
        pattern: /content_tag_ids: z\.array\(z\.number\(\)\)/,
        replacement: 'content_tag_ids: z.array(z.string())',
        count: 2,
        what: 'string content tag ids',
      },
    ],
  },
  'get-ticket-comments': {
    statements: [{ ...ZENDESK_NULL_CURSORS, count: 1 }],
    exec: [
      ZENDESK_ALWAYS_CURSOR_PAGES,
      zendeskNextCursor(
        'responseData',
        /\.\.\.\(responseData\.meta\?\.after_cursor !== undefined && \{\s*next_cursor: responseData\.meta\.after_cursor\s*\}\)/,
      ),
    ],
  },
  'get-ticket': {
    statements: [
      {
        pattern: /group_id: z\.number\(\)\.optional\(\)/,
        replacement: 'group_id: z.number().nullish()',
        count: 2,
        what: 'ticket without a group',
      },
      {
        pattern: /^(export const \w+OutputSchema = z\.object\(\{[\s\S]*?)(\s*\}\);)$/,
        replacement:
          "$1,\n    sideloads: z.record(z.string(), z.unknown()).optional().describe('Records Zendesk sideloaded for `include`, keyed by sideload name, such as users or groups.')$2",
        count: 1,
        what: 'sideloads output',
      },
    ],
    exec: [
      {
        pattern: /\.\.\.\(rawTicket\.group_id !== undefined && /,
        replacement: '...(rawTicket.group_id != null && ',
        count: 1,
        what: 'ticket without a group',
      },
      {
        pattern: /(const rawTicket = ProviderTicketSchema\.parse\(response\.data\.ticket\);)/,
        replacement: '$1\nconst { ticket: _ticket, ...sideloads } = response.data;',
        count: 1,
        what: 'sideloads',
      },
      {
        pattern: /(\.\.\.\(rawTicket\.tags !== undefined && \{ tags: rawTicket\.tags \}\))/,
        replacement: '$1,\n...(input.include && Object.keys(sideloads).length > 0 && { sideloads })',
        count: 1,
        what: 'sideloads',
      },
    ],
  },
  'list-articles': {
    statements: [
      {
        pattern: /content_tag_ids: z\.array\(z\.number\(\)\)/,
        replacement: 'content_tag_ids: z.array(z.string())',
        count: 1,
        what: 'string content tag ids',
      },
    ],
    exec: [
      {
        pattern:
          /`\/api\/v2\/help_center\/(sections|categories)\/\$\{encodeURIComponent\(input\.(section_id|category_id)\)\}\/articles`/,
        replacement:
          "`/api/v2/help_center/${input.locale !== undefined ? `${encodeURIComponent(input.locale)}/` : ''}$1/${encodeURIComponent(input.$2)}/articles`",
        count: 2,
        what: 'locale for section and category listings',
      },
    ],
  },
  'list-macros': {
    statements: [
      {
        // Zendesk only cursor-pages alphabetical and date sorts, and every
        // macro listing is cursor-paged so the caller can continue it.
        pattern:
          /\.enum\(\['alphabetical', 'created_at', 'updated_at', 'usage_1h', 'usage_24h', 'usage_7d', 'usage_30d'\]\)/,
        replacement: ".enum(['alphabetical', 'created_at', 'updated_at'])",
        count: 1,
        what: 'cursor-compatible sorts',
      },
      {
        pattern: /(const ProviderResponseSchema = z\.object\(\{\s*macros: z\.array\(ProviderMacroSchema\),)/,
        replacement:
          '$1\n    meta: z.object({ has_more: z.boolean().optional(), after_cursor: z.string().nullish() }).optional(),',
        count: 1,
        what: 'cursor metadata',
      },
      {
        pattern: /^function extractCursorFromUrl\([\s\S]*\}$/,
        replacement: '',
        count: 1,
        what: 'unused offset cursor parsing',
      },
    ],
    exec: [
      ZENDESK_ALWAYS_CURSOR_PAGES,
      {
        // Cursor pages take one `sort` value (`-` for descending) instead of
        // sort_by/sort_order. Zendesk's defaults: alphabetical, ascending for
        // alphabetical and descending for the date sorts.
        pattern:
          /if \(input\.sort_by !== undefined\) \{\s*params\['sort_by'\] = input\.sort_by;\s*\}\s*if \(input\.sort_order !== undefined\) \{\s*params\['sort_order'\] = input\.sort_order;\s*\}/,
        replacement: `if (input.sort_by !== undefined || input.sort_order !== undefined) {
        const sortBy = input.sort_by ?? 'alphabetical';
        const sortOrder = input.sort_order ?? (sortBy === 'alphabetical' ? 'asc' : 'desc');
        params['sort'] = \`\${sortOrder === 'desc' ? '-' : ''}\${sortBy}\`;
      }`,
        count: 1,
        what: 'cursor sort parameter',
      },
      {
        pattern: /const next_cursor = extractCursorFromUrl\(providerData\.next_page\);/,
        replacement:
          'const next_cursor = providerData.meta?.has_more && providerData.meta.after_cursor ? providerData.meta.after_cursor : undefined;',
        count: 1,
        what: 'next cursor',
      },
    ],
  },
  'search-tickets': {
    statements: [
      {
        pattern:
          /query: z\s*\.string\(\)\s*\.describe\(\s*'Zendesk search query\. Should include "type:ticket" and any additional filters like status, tags, dates\. Example: "type:ticket status:open"'\s*\)/,
        replacement:
          "query: z.string().min(1).refine(query => !/(^|\\s)-?type:(?!ticket(\\s|$))/i.test(query.replace(/\"[^\"]*(\"|$)/g, ' ')), 'Only tickets can be searched; remove the other type: filter.').describe('Zendesk search query; results are limited to tickets. Add filters like status, tags, and dates. Example: \"status:open tags:vip\"')",
        count: 1,
        what: 'ticket-only query',
      },
    ],
    exec: [
      {
        pattern: /query: input\.query,/,
        replacement:
          'query: /(^|\\s)type:ticket(\\s|$)/i.test(input.query.replace(/"[^"]*("|$)/g, \' \')) ? input.query : `type:ticket ${input.query}`,',
        count: 1,
        what: 'ticket-only query',
      },
      {
        pattern:
          /const parsed = TicketSchema\.safeParse\(result\);\s*if \(parsed\.success\) \{\s*tickets\.push\(parsed\.data\);\s*\}/,
        replacement: 'tickets.push(TicketSchema.parse(result));',
        count: 1,
        what: 'unreadable tickets',
      },
    ],
  },
  'list-groups': {
    statements: [{ ...ZENDESK_NULL_CURSORS, count: 2 }],
    exec: [
      zendeskNextCursor(
        'responseData',
        /\.\.\.\(responseData\.meta\?\.after_cursor != null && \{ next_cursor: responseData\.meta\.after_cursor \}\)/,
      ),
    ],
  },
  'list-tickets': {
    statements: [{ ...ZENDESK_NULL_CURSORS, count: 1 }],
    exec: [
      zendeskNextCursor(
        'data',
        /\.\.\.\(data\.meta\?\.after_cursor != null && \{ next_cursor: data\.meta\.after_cursor \}\)/,
      ),
    ],
  },
  'list-users': {
    statements: [
      { ...ZENDESK_NULL_CURSORS, count: 2 },
      {
        pattern: /(next|prev): z\.string\(\)\.optional\(\)/,
        replacement: '$1: z.string().nullish()',
        count: 2,
        what: 'nullable page links',
      },
    ],
  },
  'list-views': {
    statements: [{ ...ZENDESK_NULL_CURSORS, count: 2 }],
    exec: [
      zendeskNextCursor(
        'parsed',
        /\.\.\.\(parsed\.meta\?\.after_cursor !== undefined && \{ next_cursor: parsed\.meta\.after_cursor \}\)/,
      ),
    ],
  },
  'update-ticket': {
    statements: [
      {
        pattern:
          /value: z\.union\(\[z\.string\(\), z\.number\(\), z\.boolean\(\)\]\)\.describe\('The value to set for the custom field\.'\)/,
        replacement:
          "value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()]).describe('The value to set for the custom field: an array of option tags for a multi-select field, or null to clear it.')",
        count: 1,
        what: 'custom field input values',
      },
      {
        pattern: /value: z\.union\(\[z\.string\(\), z\.number\(\), z\.boolean\(\), z\.null\(\)\]\)\.optional\(\)/,
        replacement: 'value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()]).optional()',
        count: 1,
        what: 'custom field values',
      },
    ],
    exec: [
      {
        pattern: /value: string \| number \| boolean \}/,
        replacement: 'value: string | number | boolean | string[] | null }',
        count: 1,
        what: 'custom field payload type',
      },
    ],
  },
  'update-user': {
    statements: [
      {
        pattern: /organizationId: z\.number\(\)\.optional\(\)\.describe\("The ID of the user's organization\."\)/,
        replacement:
          'organizationId: z.number().optional().describe("The ID of the organization to make the user\'s only organization. Removes the user from every other organization they belong to.")',
        count: 1,
        what: 'organization description',
      },
    ],
  },
};

function adaptZendeskAction(action: ExtractedAction): ExtractedAction {
  const fixes = ZENDESK_FIXES[action.candidate.actionSlug];
  let adapted = attemptWritesOnce(action);
  if (fixes?.statements) adapted = rewriteModuleStatements(adapted, fixes.statements);
  if (fixes?.exec) adapted = rewriteExecBody(adapted, fixes.exec);
  return { ...adapted, moduleStatements: adapted.moduleStatements.filter(statement => statement.trim() !== '') };
}

function attemptWritesOnce(action: ExtractedAction): ExtractedAction {
  if (/platformProxy\.get\(/.test(action.execBody)) return action;
  return { ...action, execBody: action.execBody.replace(/retries: \d+/g, 'retries: 1') };
}

/**
 * Checks the comment pin shapes most specific first. Zod drops unknown keys,
 * so a region pin matched the bare point shape and lost its size.
 */
function figmaClientMetaOrder(count: number): StatementRewrite {
  return {
    pattern: /z\.union\(\[VectorSchema, FrameOffsetSchema, RegionSchema, FrameOffsetRegionSchema\]\)/,
    replacement: 'z.union([FrameOffsetRegionSchema, RegionSchema, FrameOffsetSchema, VectorSchema])',
    count,
    what: 'comment pin order',
  };
}

/**
 * The frame a published component or set sits in, as Figma's REST spec describes it.
 * An asset outside any frame gets `{}`, so even the page fields can be absent.
 */
const FIGMA_FRAME_INFO: StatementRewrite = {
  pattern: /const FrameInfoSchema = z\.object\(\{[\s\S]*?\}\);/,
  replacement: `const FrameInfoSchema = z.object({
  nodeId: z.string().optional(),
  name: z.string().optional(),
  backgroundColor: z.string().optional(),
  pageId: z.string().optional(),
  pageName: z.string().optional(),
  containingStateGroup: z.object({ nodeId: z.string().optional(), name: z.string().optional() }).nullish(),
  containingComponentSet: z.object({ nodeId: z.string().optional(), name: z.string().optional() }).nullish(),
});`,
  count: 1,
  what: 'frame info',
};

/** Figma URLs write node ids with a dash (`node-id=91-1`); the API and its response keys use a colon. */
const FIGMA_NODE_ID_HELPER = "const figmaNodeId = (id: string) => id.replace(/-/g, ':');";

function figmaNodeIdDescription(pattern: RegExp, field: string, what: string): StatementRewrite {
  return {
    pattern,
    replacement: `${field}.describe('${what}, as in "91:1". The "91-1" form from a Figma URL works too.')`,
    count: 1,
    what: 'node id description',
  };
}

/**
 * Corrections to the Figma templates, each found reviewing them against
 * Figma's REST API spec:
 * - Comment pins were matched least specific first, dropping their offsets.
 * - Comments may omit `resolved_at`, and replies have a `null` `order_id`;
 *   get_comment kept only node pins, dropping canvas and region pins.
 * - The comments endpoint has no pages, yet list_comments offered a cursor.
 * - Figma's version `next_page` pages back with `before`; list_versions read
 *   and sent `after`, so it never offered older versions, and get_version
 *   walked `prev_page` from the newest page, so it only searched one page.
 * - Team component frames used snake_case keys Figma never sends, and team
 *   component sets rejected the `null` state group Figma sends.
 * - Agents copy node ids from Figma URLs, where they use a dash.
 * - A 403 (missing scope or access) was reported as a missing component set.
 * - list_styles read its team from connection metadata nobody sets; the other
 *   team listings take `team_id` as input.
 * - Dev resource responses carry optional error ids and full updated links.
 * - A comment can come back with a `null` pin.
 * - Variable values can be a composed color (a color with a separately
 *   bound opacity), which update_variables refused.
 * - get_version could walk 100 pages of history, each with retries, and then
 *   reported a version it never reached as missing.
 * Drop an entry once the upstream template is fixed.
 */
const FIGMA_FIXES: Readonly<
  Record<string, ProviderActionFixes & { helpers?: readonly string[]; description?: string }>
> = {
  'list-comments': {
    statements: [
      {
        pattern:
          /,\s*cursor: z\.string\(\)\.optional\(\)\.describe\('Pagination cursor\. Not used by this endpoint; reserved for future compatibility\.'\)/,
        replacement: '',
        count: 1,
        what: 'unused cursor',
      },
      {
        pattern: /,\s*next_cursor: z\.string\(\)\.optional\(\)/,
        replacement: '',
        count: 1,
        what: 'unused next cursor',
      },
      {
        pattern: /resolved_at: z\.string\(\)\.nullable\(\)/,
        replacement: 'resolved_at: z.string().nullish()',
        count: 1,
        what: 'optional resolved_at',
      },
      figmaClientMetaOrder(2),
      {
        pattern:
          /(client_meta: z\.union\(\[FrameOffsetRegionSchema, RegionSchema, FrameOffsetSchema, VectorSchema\]\))(?!\.optional)/,
        replacement: '$1.nullable()',
        count: 1,
        what: 'null comment pin',
      },
    ],
    exec: [
      {
        pattern: /client_meta: providerComment\.client_meta\b/,
        replacement: '...(providerComment.client_meta != null && { client_meta: providerComment.client_meta })',
        count: 1,
        what: 'null comment pin',
      },
      {
        pattern: /providerComment\.resolved_at !== null/,
        replacement: 'providerComment.resolved_at != null',
        count: 1,
        what: 'absent resolved_at',
      },
    ],
  },
  'create-comment': {
    helpers: [FIGMA_NODE_ID_HELPER],
    statements: [
      figmaClientMetaOrder(1),
      figmaNodeIdDescription(
        /node_id: z\.string\(\)\.optional\(\)\.describe\('The node ID to attach the comment to\. Example: "91:1"'\)/,
        'node_id: z.string().optional()',
        'The node ID to attach the comment to',
      ),
    ],
    exec: [
      {
        pattern: /node_id: input\.node_id\b/,
        replacement: 'node_id: figmaNodeId(input.node_id)',
        count: 1,
        what: 'node id',
      },
    ],
  },
  'get-comment': {
    statements: [
      {
        pattern: /const ClientMetaSchema = z\.object\(\{[\s\S]*?\}\);/,
        replacement: `const ClientMetaSchema = z.object({
  node_id: z.string().optional(),
  node_offset: NodeOffsetSchema.optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  region_height: z.number().optional(),
  region_width: z.number().optional(),
  comment_pin_corner: z.string().optional(),
});`,
        count: 1,
        what: 'comment pin',
      },
      {
        pattern: /client_meta: z\s*\.object\(\{\s*node_id[\s\S]*?\.optional\(\)\s*\}\)\s*\.optional\(\)/,
        replacement: 'client_meta: ClientMetaSchema.optional()',
        count: 1,
        what: 'output comment pin',
      },
      {
        pattern: /order_id: z\.string\(\)\.optional\(\)/,
        replacement: 'order_id: z.string().nullish()',
        count: 2,
        what: 'reply order_id',
      },
    ],
    exec: [
      {
        pattern: /\.\.\.\(comment\.client_meta != null && \{[\s\S]*?node_offset\.y\s*\}\s*\}\)\s*\}\s*\}\)/,
        replacement: '...(comment.client_meta != null && { client_meta: comment.client_meta })',
        count: 1,
        what: 'comment pin mapping',
      },
      {
        pattern: /comment\.order_id !== undefined/,
        replacement: 'comment.order_id != null',
        count: 1,
        what: 'reply order_id',
      },
    ],
  },
  'list-comment-reactions': {
    exec: [
      {
        pattern: /new URL\(providerResponse\.pagination\.next_page\)/,
        replacement: "new URL(providerResponse.pagination.next_page, 'https://api.figma.com')",
        count: 1,
        what: 'relative next page',
      },
    ],
  },
  'list-versions': {
    exec: [
      {
        pattern: /\.\.\.\(input\.cursor !== undefined && \{ after: input\.cursor \}\)/,
        replacement: '...(input.cursor !== undefined && { before: input.cursor })',
        count: 1,
        what: 'older versions',
      },
      {
        pattern:
          /new URL\(nextPageUrl\);\s*const afterParam = url\.searchParams\.get\('after'\);\s*if \(afterParam\) \{\s*nextCursor = afterParam;\s*\}/,
        replacement: `new URL(nextPageUrl, 'https://api.figma.com');
const before = url.searchParams.get('before');
if (before && before !== input.cursor && providerResponse.versions.length > 0) {
  nextCursor = before;
}`,
        count: 1,
        what: 'next cursor',
      },
    ],
  },
  'get-version': {
    exec: [
      {
        pattern: /let params: Record<string, string> = \{\};/,
        replacement: "let params: Record<string, string> = { page_size: '50' };\nlet pages = 0;",
        count: 1,
        what: 'version pages',
      },
      {
        pattern:
          /const prevPageUrl = parsed\.pagination\?\.prev_page;\s*if \(!prevPageUrl\) break;\s*params = Object\.fromEntries\(new URL\(prevPageUrl\)\.searchParams\.entries\(\)\);/,
        replacement: `const nextPageUrl = parsed.pagination?.next_page;
const before = nextPageUrl ? new URL(nextPageUrl, 'https://api.figma.com').searchParams.get('before') : null;
// Figma repeats the last page instead of ending, so stop when the cursor stops moving.
if (!before || before === params['before'] || parsed.versions.length === 0) break;
if (++pages >= FIGMA_VERSION_PAGES) {
  throw new platformProxy.ActionError({
    type: 'search_limit',
    message: \`Version \${input.version_id} is not among the newest \${FIGMA_VERSION_PAGES * 50} versions of file \${input.file_key}. Page further back with figma_list_versions, passing its cursor.\`,
  });
}
params = { page_size: '50', before };`,
        count: 1,
        what: 'older version pages',
      },
    ],
    helpers: ['const FIGMA_VERSION_PAGES = 20;'],
    description:
      'Retrieve a single version from Figma by id. Searches the newest 1,000 versions; for an older version, page through figma_list_versions instead.',
  },
  'get-file-node': {
    helpers: [FIGMA_NODE_ID_HELPER],
    statements: [
      {
        pattern:
          /(const ComponentSetSchema = z\.object\(\{[\s\S]*?documentationLinks: z\.array\(z\.object\(\{ uri: z\.string\(\) \}\)\))(,\s*remote: z\.boolean\(\))/,
        replacement: '$1.optional()$2.optional()',
        count: 1,
        what: 'component set metadata',
      },
      figmaNodeIdDescription(
        /node_id: z\.string\(\)\.describe\('The ID of the node to retrieve\. Example: "91:1"'\)/,
        'node_id: z.string()',
        'The ID of the node to retrieve',
      ),
    ],
    exec: [
      { pattern: /ids: input\.node_id/, replacement: 'ids: figmaNodeId(input.node_id)', count: 1, what: 'node id' },
      {
        pattern: /responseData\.nodes\[input\.node_id\]/,
        replacement: 'responseData.nodes[figmaNodeId(input.node_id)]',
        count: 1,
        what: 'node lookup',
      },
    ],
  },
  'list-file-nodes': {
    helpers: [FIGMA_NODE_ID_HELPER],
    statements: [
      figmaNodeIdDescription(
        /ids: z\.array\(z\.string\(\)\.min\(1\)\)\.min\(1\)\.describe\('Node IDs to retrieve\. Example: \["91:1", "1:2"\]'\)/,
        'ids: z.array(z.string().min(1)).min(1)',
        'Node IDs to retrieve. The response keys each node by its colon form',
      ),
    ],
    exec: [
      {
        pattern: /ids: input\.ids\.join\(','\)/,
        replacement: "ids: input.ids.map(figmaNodeId).join(',')",
        count: 1,
        what: 'node ids',
      },
    ],
  },
  'render-images': {
    helpers: [FIGMA_NODE_ID_HELPER],
    statements: [
      figmaNodeIdDescription(
        /node_ids: z\.array\(z\.string\(\)\)\.nonempty\(\)\.describe\('Node IDs to render\. Example: \["91:1"\]'\)/,
        'node_ids: z.array(z.string()).nonempty()',
        'Node IDs to render. The response keys each image by its node id in colon form',
      ),
    ],
    exec: [
      {
        pattern: /ids: input\.node_ids\.join\(','\)/,
        replacement: "ids: input.node_ids.map(figmaNodeId).join(',')",
        count: 1,
        what: 'node ids',
      },
    ],
  },
  'get-component-set': {
    exec: [
      {
        pattern:
          /httpStatus === 404 \|\| httpStatus === 403\) \{([\s\S]*?)message: 'Component set not found or access denied'/,
        replacement: "httpStatus === 404) {$1message: 'Component set not found'",
        count: 1,
        what: 'access errors',
      },
    ],
  },
  'list-styles': {
    statements: [
      {
        pattern:
          /cursor: z\.string\(\)\.optional\(\)\.describe\('Pagination cursor from the previous response\. Omit for the first page\.'\)/,
        replacement: `team_id: z.string().describe('Team ID. Example: "1639747348117609063"'),
    cursor: z
      .string()
      .regex(/^\\d+$/, 'cursor must be a number')
      .optional()
      .describe('Pagination cursor from the previous response. Omit for the first page.')`,
        count: 1,
        what: 'team input',
      },
    ],
    exec: [
      {
        pattern: /const rawMetadata = await \w+\.getMetadata\(\);[\s\S]*?const teamId = metadataResult\.data\.team_id;/,
        replacement: 'const teamId = input.team_id;',
        count: 1,
        what: 'team from input',
      },
      {
        pattern:
          /if \(input\.cursor !== undefined && Number\.isNaN\(after\)\) \{\s*throw new [\w.]+\(\{[\s\S]*?\}\);\s*\}/,
        replacement: '',
        count: 1,
        what: 'cursor check in schema',
      },
    ],
  },
  'get-file-components': { statements: [FIGMA_FRAME_INFO] },
  'get-file-component-sets': { statements: [FIGMA_FRAME_INFO] },
  'list-components': { statements: [FIGMA_FRAME_INFO] },
  'list-component-sets': { statements: [FIGMA_FRAME_INFO] },
  'create-dev-resources': {
    helpers: [FIGMA_NODE_ID_HELPER],
    statements: [
      {
        pattern: /(const DevResourceCreateSchema = z\.object\(\{[\s\S]*?node_id: z\.string\(\))/,
        replacement: `$1.describe('The node to link, as in "91:1". The "91-1" form from a Figma URL works too.')`,
        count: 1,
        what: 'node id description',
      },
      {
        pattern: /(file_key|node_id): z\.string\(\)\.nullable\(\)/,
        replacement: '$1: z.string().nullish()',
        count: 2,
        what: 'optional error target',
      },
    ],
    exec: [
      {
        pattern: /node_id: resource\.node_id\b/,
        replacement: 'node_id: figmaNodeId(resource.node_id)',
        count: 1,
        what: 'node id',
      },
    ],
  },
  'list-dev-resources': {
    helpers: [FIGMA_NODE_ID_HELPER],
    statements: [
      {
        pattern:
          /'Optional list of node IDs to filter dev resources by\. Only dev resources attached to these nodes will be returned\.'/,
        replacement:
          '\'Optional node IDs to filter by, as in "91:1". The "91-1" form from a Figma URL works too. Only dev resources attached to these nodes are returned.\'',
        count: 1,
        what: 'node id description',
      },
    ],
    exec: [
      {
        pattern: /params\['node_ids'\] = input\.node_ids\.join\(','\);/,
        replacement: "params['node_ids'] = input.node_ids.map(figmaNodeId).join(',');",
        count: 1,
        what: 'node ids',
      },
    ],
  },
  'update-variables': {
    statements: [
      {
        pattern: /(const VariableModeValueSchema = )/,
        replacement: `const VariableComposedColorSchema = z.union([
  z.object({ color: ColorSchema, opacity: VariableAliasSchema }),
  z.object({ color: VariableAliasSchema, opacity: z.union([z.number(), VariableAliasSchema]) }),
]);

$1`,
        count: 1,
        what: 'composed color',
      },
      {
        pattern:
          /value: z\.union\(\[z\.boolean\(\), z\.number\(\), z\.string\(\), ColorSchema, VariableAliasSchema, z\.null\(\)\]\)/,
        replacement:
          'value: z.union([z.boolean(), z.number(), z.string(), VariableComposedColorSchema, ColorSchema, VariableAliasSchema, z.null()])',
        count: 1,
        what: 'composed color value',
      },
    ],
  },
  'update-dev-resources': {
    statements: [
      {
        pattern: /links_updated: z\.array\(z\.string\(\)\)\.optional\(\)/,
        replacement:
          'links_updated: z.array(z.union([z.string(), z.object({ id: z.string() }).passthrough()])).optional()',
        count: 1,
        what: 'updated links',
      },
      {
        pattern: /id: z\.string\(\),(\s*)error: z\.string\(\)/,
        replacement: 'id: z.string().optional(),$1error: z.string()',
        count: 2,
        what: 'optional error id',
      },
    ],
    exec: [
      {
        pattern: /links_updated: providerResponse\.links_updated \?\? \[\]/,
        replacement:
          "links_updated: (providerResponse.links_updated ?? []).map(link => (typeof link === 'string' ? link : link.id))",
        count: 1,
        what: 'updated link ids',
      },
    ],
  },
};

function adaptFigmaAction(action: ExtractedAction): ExtractedAction {
  const fixes = FIGMA_FIXES[action.candidate.actionSlug];
  let adapted = attemptWritesOnce(action);
  if (fixes?.statements) adapted = rewriteModuleStatements(adapted, fixes.statements);
  if (fixes?.exec) adapted = rewriteExecBody(adapted, fixes.exec);
  if (fixes?.helpers) adapted = { ...adapted, moduleStatements: [...fixes.helpers, ...adapted.moduleStatements] };
  if (fixes?.description) adapted = { ...adapted, description: fixes.description };
  return adapted;
}

/** Exa's current search categories: `publication` and `people` replaced `research paper` and `linkedin profile`, and `pdf`, `github`, and `tweet` are deprecated. */
const EXA_CATEGORY_ENUM = "z.enum(['company', 'people', 'publication', 'news', 'personal site', 'financial report'])";

/**
 * Corrections to the Exa templates, from Exa's current API reference and changelog:
 * - The category and search-type enums list values Exa has retired
 *   (`tweet` now answers 400) and miss `publication`, `people`, and `lite`;
 *   the search description still named the retired neural and keyword types.
 * - Exa ignores `startCrawlDate` and `endCrawlDate`.
 * - `maxAgeHours` replaced `livecrawl` on contents.
 * - Titles, URLs, dates, images, and favicons can be `null`, and one such
 *   result failed a whole search or answer.
 * - get_contents checked for a content option in execute, and Exa refuses
 *   category/filter combinations, summaries on `lite`, and content ages over
 *   720 hours that the templates let through, and blank queries would be
 *   sent as billed searches; the schemas say so now.
 * Drop an entry once the upstream template is fixed.
 */
const EXA_FIXES: Readonly<Record<string, ProviderActionFixes & { description?: string }>> = {
  search: {
    description:
      "Search the web with Exa and return ranked results, optionally with each page's text, highlights, or summary.",
    statements: [
      {
        pattern:
          /type: z\s*\.enum\(\['auto', 'neural', 'keyword', 'fast', 'instant', 'deep-lite', 'deep', 'deep-reasoning'\]\)\s*\.optional\(\)\s*\.describe\(\s*"[^"]*"\s*\)/,
        replacement:
          "type: z.enum(['auto', 'lite', 'fast', 'instant', 'deep-lite', 'deep', 'deep-reasoning']).optional().describe(\"Search type: 'auto' (default), 'lite' or 'instant' for the lowest latency ('lite' returns no summaries), 'fast', or 'deep-lite', 'deep', or 'deep-reasoning' for multi-step search that takes several seconds and costs more.\")",
        count: 1,
        what: 'search types',
      },
      {
        pattern: /category: z\s*\.enum\(\[[^\]]*\]\)\s*\.optional\(\)\s*\.describe\('Content category filter\.'\)/,
        replacement: `category: ${EXA_CATEGORY_ENUM}.optional().describe('Content category filter. company and people do not accept published-date filters, and people does not accept excludeDomains.')`,
        count: 1,
        what: 'categories',
      },
      {
        pattern:
          /,\s*(start|end)CrawlDate: z\s*\.string\(\)\s*\.refine\([^\n]*\)\s*\.optional\(\)\s*\.describe\('[^']*'\)/,
        replacement: '',
        count: 2,
        what: 'crawl dates',
      },
      {
        pattern: /(summary: SummaryInputSchema\.optional\(\)\.describe\('[^']*'\)\s*\}\))/,
        replacement: `$1
    .refine(input => !['company', 'people'].includes(input.category ?? '') || (input.startPublishedDate === undefined && input.endPublishedDate === undefined), { message: 'The company and people categories do not accept published-date filters.', path: ['category'] })
    .refine(input => input.category !== 'people' || input.excludeDomains === undefined, { message: 'The people category does not accept excludeDomains.', path: ['excludeDomains'] })
    .refine(input => input.type !== 'lite' || input.summary === undefined, { message: 'The lite search type does not return summaries; use auto or ask for text or highlights.', path: ['summary'] })`,
        count: 1,
        what: 'category filters',
      },
      {
        pattern: /query: z\.string\(\)\.min\(1\)\.describe\('The search query string\.'\)/,
        replacement: "query: z.string().trim().min(1).describe('The search query string.')",
        count: 1,
        what: 'blank queries',
      },
      {
        pattern: /(title|url|publishedDate|image|favicon): z\.string\(\)\.optional\(\)/,
        replacement: '$1: z.string().nullish()',
        count: 5,
        what: 'nullable result fields',
      },
    ],
    exec: [
      {
        pattern: /if \(input\.(start|end)CrawlDate !== undefined\) \{\s*requestBody\['\w+'\] = input\.\w+;\s*\}\s*/,
        replacement: '',
        count: 2,
        what: 'crawl dates',
      },
    ],
  },
  'get-contents': {
    statements: [
      {
        pattern: /livecrawl: z\.enum\(\['never', 'fallback', 'always', 'auto'\]\)\.optional\(\)\s*\}\)/,
        replacement: `maxAgeHours: z.number().int().min(-1).max(720).optional().describe('Maximum age in hours (up to 720) of cached content Exa may return before crawling the page again. 0 always crawls; -1 only uses the cache.')
}).refine(input => input.text !== undefined || input.highlights !== undefined || input.summary !== undefined, { message: 'Provide at least one of text, highlights, or summary.' })`,
        count: 1,
        what: 'content age and options',
      },
    ],
    exec: [
      {
        pattern: /if \(!input\.text && !input\.highlights && !input\.summary\) \{[\s\S]*?\}\);\s*\}\s*/,
        replacement: '',
        count: 1,
        what: 'content option check',
      },
      {
        pattern: /\.\.\.\(input\.livecrawl !== undefined && \{ livecrawl: input\.livecrawl \}\)/,
        replacement: '...(input.maxAgeHours !== undefined && { maxAgeHours: input.maxAgeHours })',
        count: 1,
        what: 'content age',
      },
    ],
  },
  answer: {
    statements: [
      {
        pattern: /query: z\.string\(\)\.describe\(/,
        replacement: 'query: z.string().trim().min(1).describe(',
        count: 1,
        what: 'blank questions',
      },
      {
        pattern: /(title|url|text): z\.string\(\)\.optional\(\)/,
        replacement: '$1: z.string().nullish()',
        count: 6,
        what: 'nullable citation fields',
      },
    ],
  },
};

function adaptExaAction(action: ExtractedAction): ExtractedAction {
  const fixes = EXA_FIXES[action.candidate.actionSlug];
  let adapted = action;
  if (fixes?.statements) adapted = rewriteModuleStatements(adapted, fixes.statements);
  if (fixes?.exec) adapted = rewriteExecBody(adapted, fixes.exec);
  if (fixes?.description) adapted = { ...adapted, description: fixes.description };
  return adapted;
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
  let adapted = attemptWritesOnce(acceptGitLabProjectIdOrPath(encodeGitLabPathSegments(action)));
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

const ATLASSIAN_API_ORIGIN = 'https://api.atlassian.com';
const CONFLUENCE_SITE_BASE =
  /^(?:`https:\/\/api\.atlassian\.com\/ex\/confluence\/\$\{(\w+)\}`|'https:\/\/api\.atlassian\.com\/ex\/confluence\/' \+ (\w+))$/;

/**
 * Lets the named fields of one schema statement be null. Confluence sends
 * `null` for these when they are unset, and the templates only accept them
 * absent, so a successful response (sometimes after a write) failed to parse.
 */
function nullableFields(action: ExtractedAction, schema: string, fields: readonly string[]): ExtractedAction {
  const declares = new RegExp(`^(?:export )?const ${schema} = `);
  const matching = action.moduleStatements.filter(statement => declares.test(statement));
  if (matching.length !== 1) {
    throw new Error(
      `Unable to adapt ${action.candidate.providerId}/${action.candidate.actionSlug} (${schema}); the upstream template shape changed.`,
    );
  }
  return {
    ...action,
    moduleStatements: action.moduleStatements.map(statement =>
      statement === matching[0]
        ? fields.reduce(
            (text, field) =>
              replaceOnce(
                text,
                new RegExp(`\\b${field}: (z\\.\\w+\\(\\))(?:\\.optional\\(\\))?,`),
                `${field}: $1.nullish(),`,
                action,
                `nullable ${schema}.${field}`,
              ),
            statement,
          )
        : statement,
    ),
  };
}

/** Maps a field only when it is set, now that it can be null. */
function skipNullFields(action: ExtractedAction, record: string, fields: readonly string[]): ExtractedAction {
  return {
    ...action,
    execBody: fields.reduce(
      (body, field) =>
        replaceOnce(
          body,
          new RegExp(`\\b${record}\\.${field} !== undefined`),
          `${record}.${field} != null`,
          action,
          `null ${field}`,
        ),
      action.execBody,
    ),
  };
}

/** Adds a deterministic input constraint the template only checked in exec. */
function refineInput(action: ExtractedAction, refinement: string): ExtractedAction {
  return rewriteModuleStatements(action, [
    {
      pattern: new RegExp(`^(export const ${action.inputSchemaName} = z\\.object\\(\\{[\\s\\S]*\\}\\))(;?\\s*)$`),
      replacement: `$1${refinement.replace(/\$/g, '$$$$')}$2`,
      count: 1,
      what: 'input constraint',
    },
  ]);
}

function rewriteExec(action: ExtractedAction, pattern: RegExp, replacement: string, what: string): ExtractedAction {
  return { ...action, execBody: replaceOnce(action.execBody, pattern, replacement, action, what) };
}

/** The `{ results, meta, _links }` envelope Confluence v2 uses for included collections. */
const CONFLUENCE_INCLUDED =
  'z.object({ results: z.array(z.unknown()).optional(), meta: z.record(z.string(), z.unknown()).optional(), _links: z.record(z.string(), z.unknown()).optional() }).passthrough()';

/** Lets an included content property keep its JSON value. */
function keepPropertyValues(action: ExtractedAction, schema: string): ExtractedAction {
  return rewriteModuleStatements(action, [
    {
      pattern: new RegExp(
        `(const ${schema} = z\\.object\\(\\{\\s*id: z\\.string\\(\\)(?:\\.optional\\(\\))?,\\s*key: z\\.string\\(\\)(?:\\.optional\\(\\))?,)`,
      ),
      replacement: '$1\n  value: z.unknown().optional(),',
      count: 1,
      what: 'content property values',
    },
  ]);
}

/** A Confluence id as a decimal string, which an int64 id needs to stay exact. */
const confluenceDecimalId = (what: string, example: string) =>
  `z.string().regex(/^\\d+$/, 'must be a numeric ${what} id').describe('${what[0]!.toUpperCase()}${what.slice(1)} ID. Example: "${example}"')`;

/** The formats the bulk page and blog-post endpoints return bodies in. */
const CONFLUENCE_BULK_BODY_FORMAT = "z.enum(['storage', 'atlas_doc_format'])";

/**
 * Confluence template fixes, by action slug, for request and response shapes
 * that don't match the Confluence API. Drop an entry once the upstream template
 * is fixed; each rewrite fails generation if the template changes under it.
 */
const CONFLUENCE_FIXES: Readonly<Record<string, (action: ExtractedAction) => ExtractedAction>> = {
  'create-page': action =>
    nullableFields(action, 'ProviderPageSchema', ['parentId', 'parentType', 'position', 'ownerId']),
  'create-inline-comment': action =>
    refineInput(
      rewriteExec(
        nullableFields(action, 'ProviderInlineCommentSchema', ['resolutionLastModifierId', 'resolutionLastModifiedAt']),
        // The input schema enforces both, so exec need not check them again.
        /if \(!input\.pageId && !input\.blogPostId && !input\.parentCommentId\) \{[\s\S]*?\}\);\s*\}\s*if \(!input\.parentCommentId && !input\.inlineCommentProperties\) \{[\s\S]*?\}\);\s*\}/,
        '',
        'inline comment target checks',
      ),
      `.refine(input => Boolean(input.pageId || input.blogPostId || input.parentCommentId), 'At least one of pageId, blogPostId, or parentCommentId is required.').refine(input => Boolean(input.parentCommentId || input.inlineCommentProperties), { message: 'inlineCommentProperties is required for top-level inline comments.', path: ['inlineCommentProperties'] })`,
    ),
  'create-footer-comment': action =>
    refineInput(
      rewriteExec(
        action,
        // The input schema allows exactly one target, so exec only picks it.
        /let targetKey: string \| undefined;[\s\S]*?type: 'missing_target',[\s\S]*?\}\);\s*\}/,
        `const [targetKey, targetValue] = (
        [
          ['pageId', input.pageId],
          ['blogPostId', input.blogPostId],
          ['attachmentId', input.attachmentId],
          ['parentCommentId', input.parentCommentId],
          ['customContentId', input.customContentId],
        ] as const
      ).find(([, value]) => value !== undefined)!;`,
        'footer comment target checks',
      ),
      `.refine(input => [input.pageId, input.blogPostId, input.attachmentId, input.parentCommentId, input.customContentId].filter(id => id !== undefined).length === 1, 'Exactly one of pageId, blogPostId, attachmentId, parentCommentId, or customContentId is required.')`,
    ),
  'update-inline-comment': action =>
    refineInput(
      rewriteExec(
        action,
        // The input schema requires one of them, so exec need not check again.
        /if \(input\.body === undefined && input\.resolved === undefined\) \{[\s\S]*?\}\);\s*\}/,
        '',
        'update field check',
      ),
      `.refine(input => input.body !== undefined || input.resolved !== undefined, 'At least one of body or resolved must be provided to update the inline comment.')`,
    ),
  'list-space-pages': action =>
    rewriteModuleStatements(nullableFields(action, 'PageSchema', ['ownerId', 'position']), [
      {
        // The space pages endpoint takes PageSortOrder values.
        pattern: /\.enum\(\[\s*'id',\s*'-id',\s*'createdAt',[^\]]*'-title',?\s*\]\)/,
        replacement:
          ".enum(['id', '-id', 'created-date', '-created-date', 'modified-date', '-modified-date', 'title', '-title'])",
        count: 1,
        what: 'space page sorts',
      },
    ]),
  'get-inline-comment': action =>
    nullableFields(action, 'InlineCommentSchema', [
      'resolutionLastModifierId',
      'resolutionLastModifiedAt',
      'resolutionStatus',
    ]),
  'get-attachment': action => keepPropertyValues(action, 'PropertySchema'),
  'get-footer-comment': action => keepPropertyValues(action, 'PropertySchema'),
  'get-page': action =>
    rewriteModuleStatements(keepPropertyValues(action, 'PropertyResultSchema'), [
      {
        // A content property value is caller JSON, so its nulls are data; only
        // the page's own nullable fields should become undefined.
        pattern:
          /function stripNulls\(value: unknown\): unknown \{\s*if \(value === null\) \{\s*return undefined;\s*\}\s*if \(Array\.isArray\(value\)\) \{\s*return value\.map\(stripNulls\);\s*\}\s*if \(typeof value === 'object' && value !== null\) \{\s*const result: Record<string, unknown> = \{\};\s*for \(const \[key, val\] of Object\.entries\(value\)\) \{\s*result\[key\] = stripNulls\(val\);\s*\}\s*return result;\s*\}\s*return value;\s*\}/,
        replacement: `function stripNulls(value: unknown, path = ''): unknown {
  if (path === 'properties.results.value') {
    return value;
  }
  if (value === null) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.map(item => stripNulls(item, path));
  }
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = stripNulls(val, path ? \`\${path}.\${key}\` : key);
    }
    return result;
  }
  return value;
}`,
        count: 1,
        what: 'content property value nulls',
      },
    ]),
  'delete-page-property': action =>
    rewriteModuleStatements(action, [
      {
        pattern: /pageId: z\.number\(\)\.describe\('Page ID\. Example: 123'\)/,
        replacement: `pageId: ${confluenceDecimalId('page', '123')}`,
        count: 1,
        what: 'page id as a decimal string',
      },
      {
        pattern: /propertyId: z\.number\(\)\.describe\('Property ID\. Example: 456'\)/,
        replacement: `propertyId: ${confluenceDecimalId('property', '456')}`,
        count: 1,
        what: 'property id as a decimal string',
      },
    ]),
  'list-pages-for-label': action => {
    const fields = ['parentId', 'parentType', 'position', 'ownerId', 'lastOwnerId', 'subtype'];
    return skipNullFields(nullableFields(action, 'PageSchema', fields), 'page', fields);
  },
  'list-pages': action => {
    let fixed = rewriteModuleStatements(action, [
      {
        pattern: /subType: z\.enum\(\['page', 'blogpost'\]\)/,
        replacement: "subType: z.enum(['page', 'live'])",
        count: 1,
        what: 'page subtypes',
      },
      {
        pattern: /sort: z\.string\(\)\.optional\(\)\.describe\('Sort order\. Example: "title asc"'\)/,
        replacement:
          "sort: z.enum(['id', '-id', 'created-date', '-created-date', 'modified-date', '-modified-date', 'title', '-title']).optional().describe('Sort order; a leading - sorts descending. Example: \"-modified-date\"')",
        count: 1,
        what: 'page sorts',
      },
      {
        pattern: /bodyFormat: z\s*\.enum\(\[[^\]]*\]\)/,
        replacement: `bodyFormat: ${CONFLUENCE_BULK_BODY_FORMAT}`,
        count: 1,
        what: 'bulk body formats',
      },
      {
        pattern: /(const ProviderVersionSchema = z\.object\(\{)/,
        replacement: '$1\n    authorId: z.string().optional(),',
        count: 1,
        what: 'version author id',
      },
    ]);
    fixed = skipNullFields(nullableFields(fixed, 'ProviderPageSchema', ['position']), 'page', ['position']);
    return rewriteExec(
      fixed,
      /(\.\.\.\(page\.version\.by !== undefined && \{)/,
      '...(page.version.authorId !== undefined && { author: { accountId: page.version.authorId } }),\n$1',
      'version author id',
    );
  },
  'list-blog-posts': action =>
    rewriteModuleStatements(action, [
      {
        pattern: /sort: z\.string\(\)\.optional\(\)\.describe\('Sort order, e\.g\. created-date desc\.'\)/,
        replacement:
          "sort: z.enum(['id', '-id', 'created-date', '-created-date', 'modified-date', '-modified-date']).optional().describe('Sort order; a leading - sorts descending. Example: \"-created-date\"')",
        count: 1,
        what: 'blog post sorts',
      },
      {
        pattern:
          /bodyFormat: z\.string\(\)\.optional\(\)\.describe\('Body format representation\. Defaults to storage\.'\)/,
        replacement: `bodyFormat: ${CONFLUENCE_BULK_BODY_FORMAT}.optional().describe('Body format representation. Defaults to storage.')`,
        count: 1,
        what: 'bulk body formats',
      },
    ]),
  'list-space-blog-posts': action =>
    rewriteModuleStatements(action, [
      {
        pattern:
          /bodyFormat: z\.string\(\)\.optional\(\)\.describe\('Body format to include such as storage, atlas_doc_format, or view\.'\)/,
        replacement: `bodyFormat: ${CONFLUENCE_BULK_BODY_FORMAT}.optional().describe('Body format to include: storage or atlas_doc_format.')`,
        count: 1,
        what: 'bulk body formats',
      },
    ]),
  'list-page-footer-comments': action =>
    rewriteModuleStatements(action, [
      {
        pattern:
          /pageId: z\.number\(\)\.describe\('The ID of the page whose footer comments should be listed\. Example: 123456'\)/,
        replacement:
          "pageId: z.string().regex(/^\\d+$/, 'must be a numeric page id').describe('The ID of the page whose footer comments should be listed. Example: \"123456\"')",
        count: 1,
        what: 'page id as a decimal string',
      },
    ]),
  'list-page-attachments': action =>
    rewriteExec(
      rewriteModuleStatements(action, [
        {
          pattern: /(\s*)(links: z\s*\.object\(\{)/,
          replacement:
            '$1_links: z.object({ download: z.string().optional(), webui: z.string().optional(), thumbnail: z.string().optional() }).passthrough().optional(),$1downloadLink: z.string().optional(),$1webuiLink: z.string().optional(),$1$2',
          count: 1,
          what: 'attachment links',
        },
      ]),
      /\.\.\.\(parsed\.links !== undefined && \{ links: parsed\.links \}\)/,
      `...(() => {
                const download = parsed.links?.download ?? parsed.downloadLink ?? parsed._links?.download;
                const webui = parsed.links?.webui ?? parsed.webuiLink ?? parsed._links?.webui;
                const thumbnail = parsed.links?.thumbnail ?? parsed._links?.thumbnail;
                return download !== undefined || webui !== undefined || thumbnail !== undefined
                    ? { links: { ...(download !== undefined && { download }), ...(webui !== undefined && { webui }), ...(thumbnail !== undefined && { thumbnail }) } }
                    : {};
            })()`,
      'attachment links',
    ),
  'get-blog-post': action => {
    const fixed = rewriteModuleStatements(action, [
      {
        pattern: /labels: z\.array\(z\.unknown\(\)\)\.optional\(\),/,
        replacement: `labels: ${CONFLUENCE_INCLUDED}.optional(),`,
        count: 2,
        what: 'included labels',
      },
      {
        pattern: /properties: z\.record\(z\.string\(\), z\.unknown\(\)\)\.optional\(\),/,
        replacement: `properties: ${CONFLUENCE_INCLUDED}.optional(),`,
        count: 2,
        what: 'included properties',
      },
      {
        pattern: /likes: z\.object\(\{ count: z\.number\(\)\.optional\(\) \}\)\.optional\(\)/,
        replacement: `likes: ${CONFLUENCE_INCLUDED}.optional(), operations: ${CONFLUENCE_INCLUDED}.optional(), versions: ${CONFLUENCE_INCLUDED}.optional()`,
        count: 2,
        what: 'included likes, operations, and versions',
      },
    ]);
    return rewriteExec(
      rewriteExec(
        fixed,
        /params\['include'\] = include;/,
        "for (const part of include.split(',')) {\n                params[`include-${part}`] = 'true';\n            }",
        'v2 include parameters',
      ),
      /(\.\.\.\(blogPost\.likes !== undefined && \{ likes: blogPost\.likes \}\))/,
      '$1,\n            ...(blogPost.operations !== undefined && { operations: blogPost.operations }),\n            ...(blogPost.versions !== undefined && { versions: blogPost.versions })',
      'included operations and versions',
    );
  },
  'search-content': action =>
    rewriteModuleStatements(action, [
      {
        pattern: /(const SpaceSchema = z\s*\.object\(\{\s*)id: z\.string\(\),/,
        replacement: '$1id: z.union([z.number().int(), z.string()]).optional(),',
        count: 1,
        what: 'v1 space id',
      },
    ]),
  'delete-page': action =>
    rewriteModuleStatements(action, [
      {
        pattern: /\.describe\('Permanently delete the page without moving it to trash\.'\)/,
        replacement:
          ".describe('Permanently delete a page that is already in the trash. Delete it without purge first to move it to the trash.')",
        count: 1,
        what: 'purge description',
      },
    ]),
  'update-page': action =>
    rewriteExec(
      action,
      /const nextVersionNumber = currentPage\.version\.number \+ 1;/,
      // Confluence numbers a draft update as version 1.
      "const nextVersionNumber = input.status === 'draft' ? 1 : currentPage.version.number + 1;",
      'draft version number',
    ),
  'update-blog-post': action =>
    rewriteExec(
      action,
      /number: currentVersion \+ 1/,
      // Confluence numbers a draft update as version 1.
      "number: (input.status ?? currentPost.status ?? 'current') === 'draft' ? 1 : currentVersion + 1",
      'draft version number',
    ),
};

/**
 * Confluence templates point `baseUrlOverride` at
 * `https://api.atlassian.com/ex/confluence/{cloudId}`. The platform proxy
 * forwards only an override's origin (and only origins it allowlists), so the
 * `/ex/confluence/{cloudId}` path would be dropped. Nango's Confluence
 * provider already proxies to api.atlassian.com, so drop the override and send
 * the site path as part of the endpoint instead.
 */
function routeConfluenceThroughProviderBase(action: ExtractedAction): ExtractedAction {
  const slug = action.candidate.actionSlug;
  const wrapped = dropConfluenceBaseUrlOverrides(`async function exec() {\n${action.execBody}\n}`, slug);
  let execBody = wrapped.slice(wrapped.indexOf('{') + 1, wrapped.lastIndexOf('}')).replace(/^\n/, '');
  if (slug === 'search-content') {
    // Every other Confluence template reads the site the user connected from
    // the connection config first; this one skips straight to metadata and
    // accessible-resources, which fails for tokens that cover several sites.
    execBody = replaceOnce(
      execBody,
      /let cloudId = metaResult\.success \? metaResult\.data\.cloudId : undefined;/,
      `const connection = await platformProxy.getConnection();
      const configCloudId = connection.connection_config?.['cloudId'];
      let cloudId =
        typeof configCloudId === 'string' && configCloudId
          ? configCloudId
          : metaResult.success
            ? metaResult.data.cloudId
            : undefined;`,
      action,
      'connection cloudId',
    );
  }
  if (slug === 'delete-page-property') {
    // This template skips the metadata lookup every other Confluence template
    // does, so with no cloudId in the connection config it ignores the site
    // the metadata names and asks Atlassian instead.
    execBody = replaceOnce(
      execBody,
      /(let cloudId = z\.string\(\)\.optional\(\)\.parse\(connection\.connection_config\?\.\['cloudId'\]\);)/,
      `$1
        if (!cloudId) {
            const metadata = MetadataSchema.safeParse(await platformProxy.getMetadata());
            cloudId = metadata.success ? metadata.data.cloudId : undefined;
        }`,
      action,
      'metadata cloudId',
    );
  }
  if (slug === 'update-footer-comment') {
    // Every other Confluence template lets the site in the connection config
    // win over the one cached in metadata; this one checks metadata first, so
    // when they disagree it writes to a different site than the reads use.
    execBody = replaceOnce(
      execBody,
      /(const metadata = await (?:nango|platformProxy)\.getMetadata\(\);\s*const rawMetadataCloudId[\s\S]*?cloudId = rawMetadataCloudId;\s*\})(\s*)if \(!cloudId\) \{\s*(const connection = await (?:nango|platformProxy)\.getConnection\(\);[\s\S]*?cloudId = rawCloudId;\s*\}\s*\})\s*\}/,
      `$3$2if (!cloudId) {
            $1
        }`,
      action,
      'connection cloudId first',
    );
  }
  // Most Confluence templates refuse to pick a site when the token can see
  // several and none has been chosen; these three take the first one and cache
  // it, which silently moves every later call onto that site.
  const pickedSite = {
    'delete-page-property': [/const firstResource = resources\[0\];/, 'resources'],
    'create-page': [/const firstResourceSchema = z\.object\(\{/, 'resources.data'],
    'update-footer-comment': [/if \(!accessibleResources\[0\]\) \{/, 'accessibleResources'],
  } as const satisfies Record<string, readonly [RegExp, string]>;
  if (slug in pickedSite) {
    const [anchor, list] = pickedSite[slug as keyof typeof pickedSite];
    execBody = replaceOnce(
      execBody,
      new RegExp(`(${anchor.source})`),
      `if (${list}.length > 1) {
                throw new platformProxy.ActionError({
                    type: 'ambiguous_cloud_id',
                    message: 'Multiple Confluence sites found. Please set an explicit cloudId in the connection metadata.',
                });
            }
            $1`,
      action,
      'single accessible site',
    );
  }
  // Most templates put ids into the path as-is, so an id carrying `?`, `#`,
  // `/` or `\` could add query options (such as purge=true) or reach another
  // resource. Encoding keeps every input value inside its own path segment.
  execBody = execBody.replace(/endpoint: `[^`]*`/g, endpoint =>
    endpoint.replace(/\$\{(input\.\w+)\}/g, '${encodeURIComponent($1)}'),
  );
  const routed = {
    ...action,
    execBody,
    moduleStatements: action.moduleStatements.map(statement =>
      statement.includes('baseUrlOverride') ? dropConfluenceBaseUrlOverrides(statement, slug) : statement,
    ),
  };
  return CONFLUENCE_FIXES[slug]?.(routed) ?? routed;
}

export function dropConfluenceBaseUrlOverrides(code: string, slug: string): string {
  const source = new Project({ useInMemoryFileSystem: true }).createSourceFile('code.ts', code);
  const initializerOf = (name: string): string | undefined =>
    source
      .getDescendantsOfKind(SyntaxKind.VariableDeclaration)
      .find(declaration => declaration.getName() === name)
      ?.getInitializer()
      ?.getText();

  const overrides = source.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression).flatMap(literal => {
    const property = literal.getProperty('baseUrlOverride');
    return property ? [{ literal, property }] : [];
  });
  for (const { literal, property } of overrides.reverse()) {
    let value: string | undefined;
    if (Node.isShorthandPropertyAssignment(property)) value = initializerOf(property.getName());
    else if (Node.isPropertyAssignment(property)) {
      const initializer = property.getInitializerOrThrow();
      value = Node.isIdentifier(initializer) ? initializerOf(initializer.getText()) : initializer.getText();
    }
    if (value === `'${ATLASSIAN_API_ORIGIN}'`) {
      property.remove();
      continue;
    }
    const site = value?.match(CONFLUENCE_SITE_BASE);
    const endpoint = literal.getProperty('endpoint');
    const endpointValue = Node.isPropertyAssignment(endpoint) ? endpoint.getInitializer() : undefined;
    if (
      !site ||
      !endpointValue ||
      !(
        Node.isStringLiteral(endpointValue) ||
        Node.isTemplateExpression(endpointValue) ||
        Node.isNoSubstitutionTemplateLiteral(endpointValue)
      )
    ) {
      throw new Error(
        `confluence/${slug}: unexpected baseUrlOverride ${value ?? property.getText()}; update routeConfluenceThroughProviderBase`,
      );
    }
    const cloudId = site[1] ?? site[2];
    const path = endpointValue.getText().slice(1, -1).replace(/^\//, '');
    endpointValue.replaceWithText(`\`/ex/confluence/\${${cloudId}}/${path}\``);
    property.remove();
  }

  // Drop the override variables the rewrite left unused; some templates also
  // use theirs as the base for parsing `_links.next`, so keep those.
  for (const declaration of source.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
    const initializer = declaration.getInitializer()?.getText();
    if (!initializer || !CONFLUENCE_SITE_BASE.test(initializer)) continue;
    const name = declaration.getName();
    const uses = source
      .getDescendantsOfKind(SyntaxKind.Identifier)
      .filter(identifier => identifier.getText() === name && identifier.getParent() !== declaration);
    if (uses.length > 0) continue;
    // `const limit = 25, base = ...;` keeps `limit`; only the unused declarator goes.
    const statement = declaration.getVariableStatementOrThrow();
    if (statement.getDeclarations().length === 1) statement.remove();
    else declaration.remove();
  }

  const rewritten = source.getFullText();
  if (rewritten.includes('baseUrlOverride')) {
    throw new Error(`confluence/${slug}: baseUrlOverride left after rewrite`);
  }
  return rewritten;
}

function applyProviderActionOverrides(action: ExtractedAction): ExtractedAction {
  if (action.candidate.providerId === 'gitlab') {
    return adaptGitLabAction(action);
  }
  if (action.candidate.providerId === 'zendesk') {
    return adaptZendeskAction(action);
  }
  if (action.candidate.providerId === 'figma') {
    return adaptFigmaAction(action);
  }
  if (action.candidate.providerId === 'exa') {
    return adaptExaAction(action);
  }
  if (action.candidate.providerId === 'confluence') {
    return routeConfluenceThroughProviderBase(action);
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
  if (action.candidate.providerId === 'anthropic' && action.candidate.actionSlug === 'cancel-message-batch') {
    return acceptNullBatchTimestamps(action);
  }
  if (action.candidate.providerId === 'google-analytics' && action.candidate.actionSlug === 'run-pivot-report') {
    return acceptPrefixedPivotProperty(action);
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

// Anthropic answers a cancel with null for the timestamps and results URL a
// batch doesn't have yet, and the template only accepts a string or an absent
// field, so a cancel that succeeded failed validation. Accept null and leave
// the field out of the result, as get/list/create already do. Drop this once
// the upstream template accepts null.
function acceptNullBatchTimestamps(action: ExtractedAction): ExtractedAction {
  const fields = ['archived_at', 'cancel_initiated_at', 'ended_at', 'results_url'];
  let rewrites = 0;
  const moduleStatements = action.moduleStatements.map(statement => {
    if (!statement.startsWith('const ProviderMessageBatchSchema')) return statement;
    return fields.reduce((text, field) => {
      const next = text.replace(`${field}: z.string().optional(),`, `${field}: z.string().nullish(),`);
      if (next !== text) rewrites++;
      return next;
    }, statement);
  });
  let execBody = action.execBody;
  for (const field of fields) {
    const next = execBody.replace(`batch.${field} !== undefined`, `batch.${field} != null`);
    if (next !== execBody) rewrites++;
    execBody = next;
  }
  if (rewrites !== fields.length * 2) {
    throw new Error(
      `Unable to accept null batch fields in ${action.candidate.providerId}/${action.candidate.actionSlug}; the upstream template shape changed.`,
    );
  }
  return { ...action, moduleStatements, execBody };
}

// The pivot template puts `property` into the path as given, so "properties/123" (the form
// run_report and batch_run_reports accept) became properties/properties%2F123 and Google
// answered 404. Strip the prefix as those tools do.
function acceptPrefixedPivotProperty(action: ExtractedAction): ExtractedAction {
  let schemaUpdated = false;
  const moduleStatements = action.moduleStatements.map(statement => {
    if (!statement.includes(`const ${action.inputSchemaName}`)) return statement;
    const updated = statement.replace(
      "property: z.string().describe('Google Analytics property numeric ID. Example: 535258304'),",
      'property: z.string().describe(\'GA4 property ID. Example: "properties/123456789" or "123456789"\'),',
    );
    schemaUpdated ||= updated !== statement;
    return updated;
  });
  const execBody = action.execBody.replace(
    '`/v1beta/properties/${encodeURIComponent(property)}:runPivotReport`',
    "`/v1beta/properties/${encodeURIComponent(property.replace(/^properties\\//, ''))}:runPivotReport`",
  );
  if (!schemaUpdated || execBody === action.execBody) {
    throw new Error(
      `Unable to accept a prefixed property in ${action.candidate.providerId}/${action.candidate.actionSlug}; the upstream template shape changed.`,
    );
  }
  return { ...action, moduleStatements, execBody };
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
 * Actions deliberately left out of a toolset, keyed by `<providerId>/<actionSlug>`, with the reason recorded in the
 * manifest's skipped actions. Use this for actions the generator could emit but agents shouldn't have.
 */
const EXCLUDED_ACTIONS: Readonly<Record<string, string>> = {
  // Figma's project endpoints need projects:read, which public OAuth apps can't request.
  'figma/list-projects': 'excluded: needs projects:read, which public Figma OAuth apps cannot request',
  'figma/get-project': 'excluded: needs projects:read, which public Figma OAuth apps cannot request',
  'figma/list-files': 'excluded: needs projects:read, which public Figma OAuth apps cannot request',
  // Mastra registers Figma webhooks itself; agents must not change where Figma sends events.
  'figma/list-webhooks': 'excluded: webhooks are managed by Mastra, not agents',
  'figma/get-webhook': 'excluded: webhooks are managed by Mastra, not agents',
  'figma/update-webhook': 'excluded: webhooks are managed by Mastra, not agents',
  'figma/delete-webhook': 'excluded: webhooks are managed by Mastra, not agents',
  // Exa deprecated /findSimilar in favor of /search.
  'exa/find-similar': 'excluded: Exa deprecated /findSimilar in favor of /search',
};

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

/**
 * Hand-written files (tools for endpoints no template covers, and their
 * helpers) survive regeneration; every hand-written `tools/<slug>.ts` is
 * registered alongside the generated tools, except `_`-prefixed helpers.
 */
/**
 * Finds the hand-written files in an installed provider and the tools among
 * them, so regeneration keeps both. Every hand-written `tools/<slug>.ts` is
 * registered alongside the generated tools, except `_`-prefixed helpers.
 */
export function planHandwrittenTools(
  outputDir: string,
  localId: string,
  generated: readonly ToolRegistration[],
): { handwrittenFiles: string[]; handwrittenTools: ToolRegistration[] } {
  const manifest = readManifestIn(outputDir);
  if (!manifest && Object.keys(calculateFileChecksums(outputDir)).length > 0) {
    // Without a manifest every file looks generated, so regenerating would
    // delete the hand-written ones.
    throw new Error(
      `${localId} has no readable .manifest.json, so its hand-written files cannot be told apart from generated ones. Restore the manifest, or remove the provider before regenerating it.`,
    );
  }
  const handwrittenFiles = listHandwrittenFiles(outputDir, manifest);
  const keys = new Map(generated.map(tool => [tool.key, tool.slug]));
  const factories = new Map(generated.map(tool => [tool.factoryName, tool.slug]));
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  const handwrittenTools = handwrittenFiles.flatMap(file => {
    const slug = /^tools\/([^/_][^/]*)\.ts$/.exec(file)?.[1];
    if (!slug) return [];
    const tool = { slug, key: `${localId.replace(/-/g, '_')}_${toSnake(slug)}`, factoryName: `${toCamel(slug)}Tool` };
    const clash = keys.get(tool.key) ?? factories.get(tool.factoryName);
    if (clash !== undefined) {
      throw new Error(
        `Hand-written ${localId}/${file} collides with tool '${clash}' (key ${tool.key}, factory ${tool.factoryName}); rename or remove it.`,
      );
    }
    const source = project.addSourceFileAtPath(resolve(outputDir, file));
    project.resolveSourceFileDependencies();
    const exported = source.getExportedDeclarations().get(tool.factoryName) ?? [];
    if (
      !exported.some(declaration => Node.isFunctionDeclaration(declaration) || Node.isVariableDeclaration(declaration))
    ) {
      throw new Error(`Hand-written ${localId}/${file} must export ${tool.factoryName}.`);
    }
    keys.set(tool.key, slug);
    factories.set(tool.factoryName, slug);
    return [tool];
  });
  return { handwrittenFiles, handwrittenTools };
}

export interface GeneratedTool extends ToolRegistration {
  /** The emitted module for the tool, before formatting. */
  source: string;
}

/**
 * Replaces a provider directory with freshly generated files, keeping the
 * hand-written files and tools found in it. The new directory is built aside
 * and swapped in, so a failure leaves the installed provider in place.
 */
export async function writeProvider({
  outputDir,
  providerId,
  localId,
  templateSha,
  pin,
  tools,
  skippedActions,
}: {
  outputDir: string;
  providerId: string;
  localId: string;
  templateSha: string;
  pin: TemplatePin;
  tools: readonly GeneratedTool[];
  skippedActions: ProviderManifest['skippedActions'];
}): Promise<{ toolCount: number }> {
  const { handwrittenFiles, handwrittenTools } = planHandwrittenTools(outputDir, localId, tools);
  const temporaryDir = resolve(dirname(outputDir), `.${localId}.generate-${process.pid}`);
  rmSync(temporaryDir, { recursive: true, force: true });
  mkdirSync(resolve(temporaryDir, 'tools'), { recursive: true });

  try {
    for (const tool of tools) {
      writeFileSync(resolve(temporaryDir, 'tools', `${tool.slug}.ts`), tool.source);
    }
    const registrations = [
      ...tools.map(({ slug, key, factoryName }) => ({ slug, key, factoryName })),
      ...handwrittenTools,
    ];
    writeFileSync(resolve(temporaryDir, 'tools.ts'), emitToolsFile(localId, registrations, pin));
    writeFileSync(resolve(temporaryDir, 'index.ts'), emitIndexFile(localId, pin));
    await formatGeneratedFiles(temporaryDir);
    const generatedFiles = calculateFileChecksums(temporaryDir);
    for (const file of handwrittenFiles) {
      mkdirSync(dirname(resolve(temporaryDir, file)), { recursive: true });
      copyFileSync(resolve(outputDir, file), resolve(temporaryDir, file));
    }

    const manifest: ProviderManifest = {
      providerId,
      localId,
      templateSha,
      templateRepo: pin.repo,
      generatedAt: new Date().toISOString(),
      toolCount: registrations.length,
      skippedActions,
      files: generatedFiles,
      ...(handwrittenFiles.length > 0 ? { handwrittenFiles } : {}),
    };
    writeFileSync(resolve(temporaryDir, '.manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

    // A file added while this ran would be deleted with the old directory.
    // Without a readable manifest every file there is someone else's.
    const latest = readManifestIn(outputDir);
    const current = latest ? listHandwrittenFiles(outputDir, latest) : Object.keys(calculateFileChecksums(outputDir));
    const added = current.filter(file => !handwrittenFiles.includes(file));
    if (added.length > 0) {
      throw new Error(
        `${localId} gained hand-written files while it was being regenerated (${added.join(', ')}); run it again.`,
      );
    }

    publishProvider(temporaryDir, outputDir, localId);
  } catch (error) {
    rmSync(temporaryDir, { recursive: true, force: true });
    throw error;
  }
  return { toolCount: handwrittenTools.length + tools.length };
}

/**
 * Swaps the built directory in for the installed one. The installed provider
 * is moved aside rather than deleted, so a failed swap can put it back: it
 * holds hand-written files that may not be committed anywhere else.
 */
function publishProvider(temporaryDir: string, outputDir: string, localId: string): void {
  if (!existsSync(outputDir)) {
    renameSync(temporaryDir, outputDir);
    return;
  }
  const backupRoot = mkdtempSync(resolve(dirname(outputDir), `.${localId}.backup-`));
  const backupDir = resolve(backupRoot, localId);
  try {
    renameSync(outputDir, backupDir);
  } catch (error) {
    rmSync(backupRoot, { recursive: true, force: true });
    throw error;
  }
  try {
    renameSync(temporaryDir, outputDir);
  } catch (error) {
    try {
      rmSync(outputDir, { recursive: true, force: true });
      renameSync(backupDir, outputDir);
    } catch (restoreError) {
      throw new Error(
        `Publishing ${localId} failed and the previous provider could not be restored; it is kept at ${backupDir}.`,
        { cause: new AggregateError([error, restoreError]) },
      );
    }
    rmSync(backupRoot, { recursive: true, force: true });
    throw error;
  }
  rmSync(backupRoot, { recursive: true, force: true });
}

export interface ToolRegistration {
  slug: string;
  key: string;
  factoryName: string;
}

function emitToolsFile(integrationId: string, registrations: ToolRegistration[], pin: TemplatePin): string {
  // Ordered by module path, as the import-order lint rule expects.
  const modulePath = (registration: ToolRegistration) => `./tools/${registration.slug}.js`;
  const sorted = [...registrations].sort((left, right) =>
    modulePath(left) < modulePath(right) ? -1 : modulePath(left) > modulePath(right) ? 1 : 0,
  );
  const imports = sorted
    .map(registration => `import { ${registration.factoryName} } from '${modulePath(registration)}';`)
    .join('\n');
  // Keys are quoted because a leading-digit local ID (e.g. '1password')
  // produces tool keys that are not valid bare identifiers; prettier strips
  // the quotes again wherever they are unnecessary.
  const toolEntries = sorted
    .map(registration => `    '${registration.key}': ${registration.factoryName}(platformProxy),`)
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

/**
 * Other platform catalog ids whose connections use a provider's toolset.
 * `gitlab-self-hosted` connects a self-managed instance with an access token
 * and its hostname; the proxy sends the same `/api/v4` calls there.
 */
const PROVIDER_ALIAS_INTEGRATION_IDS: Readonly<Record<string, readonly string[]>> = {
  gitlab: ['gitlab-self-hosted'],
};

function emitIndexFile(integrationId: string, pin: TemplatePin): string {
  const envVar = providerConnectionEnvVar(integrationId);
  const aliases = PROVIDER_ALIAS_INTEGRATION_IDS[integrationId];
  const aliasLine = aliases ? `\n  aliasIntegrationIds: [${aliases.map(alias => `'${alias}'`).join(', ')}],` : '';
  const factoryName = `create${toPascal(integrationId)}Tools`;
  // Shared with updateProviderIndex so the emitted export always matches the
  // import the provider index writes (including leading-digit normalization).
  const registrationName = providerRegistrationName(integrationId);
  return `// AUTO-GENERATED from ${pin.repo} @ ${pin.sha.slice(0, 12)} — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { ${factoryName} } from './tools.js';

export const ${registrationName}: ProviderRegistration = {
  integrationId: '${integrationId}',
  envVar: '${envVar}',${aliasLine}
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
    const excluded = EXCLUDED_ACTIONS[`${providerId}/${actionSlug}`];
    if (excluded) {
      skipped.push({ candidate, reason: excluded });
      continue;
    }
    const result = extractAction(project, candidate);
    if (result.kind === 'ok') extracted.push(applyProviderActionOverrides(result.value));
    else skipped.push({ candidate, reason: result.reason });
  }

  if (extracted.length === 0) {
    const reasons = skipped.map(action => `${action.candidate.actionSlug}: ${action.reason}`).join('; ');
    throw new Error(`No usable actions found for '${providerId}'. ${reasons}`);
  }

  const { toolCount } = await writeProvider({
    outputDir: providerDir(localId),
    providerId,
    localId,
    templateSha,
    pin,
    tools: extracted.map(action => ({
      slug: action.candidate.actionSlug,
      key: action.candidate.toolKey,
      factoryName: action.toolFactoryName,
      source: emitActionFile(action, pin),
    })),
    skippedActions: skipped.map(action => ({ action: action.candidate.actionSlug, reason: action.reason })),
  });

  return {
    providerId,
    localId,
    toolCount,
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
