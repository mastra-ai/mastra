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
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  Node,
  Project,
  SyntaxKind,
  type CallExpression,
  type ImportDeclaration,
  type ObjectLiteralExpression,
  type SourceFile,
  type Statement,
} from 'ts-morph';
import { format, resolveConfig } from 'prettier';

import {
  assertProviderEnvVarAvailable,
  calculateFileChecksums,
  currentTemplateSha,
  providerConnectionEnvVar,
  providerDir,
  providerRegistrationName,
  providersDir,
  templatesDir,
  validateProviderId,
  type ProviderManifest,
} from './provider-utils.js';
import { templatePinFor, type TemplatePin } from './templates-config.js';

/** Module specifier the upstream templates import their SDK from. */
const TEMPLATE_SDK_MODULE = 'nango';
const PROXY_REQUEST_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);
const PROXY_CONTEXT_METHODS = new Set([
  ...PROXY_REQUEST_METHODS,
  'getConnection',
  'getMetadata',
  'updateMetadata',
  'zodValidateInput',
  'ActionError',
  'log',
]);
const UNSUPPORTED_PROXY_OPTIONS = ['responseType'] as const;
const ALLOWED_TEMPLATE_SDK_IMPORTS = new Set(['createAction', 'ProxyConfiguration']);

interface ActionCandidate {
  providerId: string;
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
 * otherwise valid response; request-side enums stay strict.
 */
function widenResponseEnums(statements: string[], inputSchemaName: string): string[] {
  const declared = statements.map(statement => statement.match(/^(?:export\s+)?const\s+([A-Za-z_$][\w$]*)/)?.[1]);
  const inputSide = new Set<string>([inputSchemaName]);
  let changed = true;
  while (changed) {
    changed = false;
    statements.forEach((statement, index) => {
      const name = declared[index];
      if (!name || !inputSide.has(name)) return;
      for (const other of declared) {
        if (other && !inputSide.has(other) && new RegExp(`\\b${escapeRegExp(other)}\\b`).test(statement)) {
          inputSide.add(other);
          changed = true;
        }
      }
    });
  }
  return statements.map((statement, index) => {
    const name = declared[index];
    if (name && inputSide.has(name)) return statement;
    return statement.replace(/z\.enum\((\[[^\]]*\])\)(?!\.or\()/g, 'z.enum($1).or(z.string())');
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

/**
 * Actions excluded by hand, keyed by provider and action slug. Use this for
 * templates that generate uncompilable or unsafe code that the automated
 * checks can't detect; record why so the exclusion can be dropped once the
 * upstream template is fixed.
 */
const EXCLUDED_ACTIONS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'google-calendar': {
    'import-event':
      'upstream type bug: provider response schema widens attendee responseStatus to string while the output schema keeps the strict enum, so the generated module does not compile',
  },
};

function extractAction(
  project: Project,
  candidate: ActionCandidate,
): { kind: 'ok'; value: ExtractedAction } | { kind: 'skip'; reason: string } {
  const exclusionReason = Object.prototype.hasOwnProperty.call(EXCLUDED_ACTIONS, candidate.providerId)
    ? EXCLUDED_ACTIONS[candidate.providerId]?.[candidate.actionSlug]
    : undefined;
  if (exclusionReason) return { kind: 'skip', reason: `excluded: ${exclusionReason}` };

  const source = project.addSourceFileAtPath(candidate.file);
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
  // Templates that read `connection.credentials` need the raw credential the
  // platform proxy deliberately leaves out of `getConnection()`. Their calls
  // are rewritten below to `getConnectionWithCredentials()`, which fetches it
  // from the platform's credential endpoint, so only these execs ever see a
  // secret. A credential read without a getConnection call has no rewrite
  // point and cannot work.
  const readsCredentials = /\.credentials\b/.test(originalExecBody);
  if (readsCredentials && !usedContextMethods.has('getConnection')) {
    return { kind: 'skip', reason: 'exec reads connection credentials without calling getConnection' };
  }
  const usesProviderProxy = [...PROXY_REQUEST_METHODS].some(method =>
    new RegExp(`\\bnango\\.${method}\\s*\\(`).test(source.getFullText()),
  );
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
    execBody = execBody.replace(/\bplatformProxy\.getConnection\(\)/g, 'platformProxy.getConnectionWithCredentials()');
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

function emitActionFile(action: ExtractedAction, pin: TemplatePin): string {
  const proxyTypeImports = [action.usesProxyRequestType ? 'PlatformProxyRequest' : undefined].filter(
    (name): name is string => Boolean(name),
  );
  const proxyImport = `import type { PlatformProxy${proxyTypeImports.length > 0 ? `, ${proxyTypeImports.join(', ')}` : ''} } from '../../../runtime/platform-proxy.js';\n`;
  const modelOutput = modelOutputOverride(action);
  const secretFields = outputSecretFields(action);
  const redactImport = secretFields ? "import { withoutSecretFields } from '../../../runtime/redact.js';\n" : '';
  const redactedSchemaName = `${action.outputSchemaName}Redacted`;
  const omitKeys = (secretFields ?? []).map(field => `${JSON.stringify(field)}: true`).join(', ');
  const redactedSchema = secretFields
    ? `\n/** Provider secrets removed before the result leaves the tool. */\nexport const ${redactedSchemaName} = ${action.outputSchemaName}.omit({ ${omitKeys} });\n`
    : '';
  const outputSchemaName = secretFields ? redactedSchemaName : action.outputSchemaName;
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
${redactedSchema}
export function ${action.toolFactoryName}(proxy: PlatformProxy) {
  return createTool({
    id: '${action.candidate.toolKey}',
    description: ${JSON.stringify(action.description)},
    inputSchema: ${action.inputSchemaName},
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
import { applyAllowTools } from '../../toolset.js';
${imports}

export function create${toPascal(integrationId)}Tools(options?: ProviderToolsOptions) {
  const platformProxy = createPlatformProxy({ connectionId: options?.connectionId, client: options?.client });
  const tools = {
${toolEntries}
  };
  return applyAllowTools(tools, options?.allowTools);
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

  const actionDir = resolve(templatesDir, providerId, 'actions');
  if (!existsSync(actionDir)) {
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
    const candidate: ActionCandidate = {
      providerId,
      file: resolve(actionDir, filename),
      actionSlug,
      toolKey: `${localId.replace(/-/g, '_')}_${toSnake(actionSlug)}`,
    };
    const result = extractAction(project, candidate);
    if (result.kind === 'ok') extracted.push(result.value);
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
