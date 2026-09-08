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
  calculateFileChecksums,
  currentTemplateSha,
  providerDir,
  providersDir,
  templatesDir,
  validateProviderId,
  type ProviderManifest,
} from './provider-utils.js';
import { TEMPLATE_SHA } from './templates-config.js';

const SHIM_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'ActionError', 'log']);
const ALLOWED_NANGO_IMPORTS = new Set(['createAction', 'ProxyConfiguration']);

interface ActionCandidate {
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
  usesProxyConfiguration: boolean;
  usesNangoActionLocal: boolean;
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
    if (moduleName !== 'zod' && moduleName !== 'nango') {
      return `imports unsupported module: ${moduleName}`;
    }
    if (moduleName !== 'nango') continue;

    const unsupported = declaration
      .getNamedImports()
      .map(namedImport => namedImport.getName())
      .filter(name => !ALLOWED_NANGO_IMPORTS.has(name));
    if (unsupported.length > 0) {
      return `imports unsupported nango types: ${unsupported.join(', ')}`;
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
  if (Node.isTypeAliasDeclaration(statement) && statement.getName() === 'NangoActionLocal') return false;
  return true;
}

function usesNamedImport(declaration: ImportDeclaration, name: string): boolean {
  return declaration.getNamedImports().some(namedImport => namedImport.getName() === name);
}

function sanitizeVendoredSource(source: string): string {
  return source.replace(/^.*@nangohq\/custom-integrations-linting\/.*\r?\n/gm, '');
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
  const importReason = unsupportedImportReason(source);
  if (importReason) return { kind: 'skip', reason: importReason };

  const createActionCall = findCreateActionCall(source);
  if (!createActionCall) return { kind: 'skip', reason: 'no createAction() call found' };

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
  const usedNangoMethods = new Set<string>();
  for (const match of originalExecBody.matchAll(/\bnango\.([A-Za-z_$][\w$]*)/g)) {
    usedNangoMethods.add(match[1]!);
  }
  const unsupportedMethods = [...usedNangoMethods].filter(method => !SHIM_METHODS.has(method));
  if (unsupportedMethods.length > 0) {
    return { kind: 'skip', reason: `exec uses unshimmed nango methods: ${unsupportedMethods.join(', ')}` };
  }

  const actionName = toCamel(candidate.actionSlug);
  const inputSchemaName = `${actionName}InputSchema`;
  const outputSchemaName = `${actionName}OutputSchema`;
  inputDeclaration.rename(inputSchemaName);
  outputDeclaration.rename(outputSchemaName);
  inputDeclaration.getVariableStatementOrThrow().setIsExported(true);
  outputDeclaration.getVariableStatementOrThrow().setIsExported(true);

  const renamedExecBodyNode = execInitializer.getBody();
  const execBody = sanitizeVendoredSource(
    Node.isBlock(renamedExecBodyNode) ? renamedExecBodyNode.getText() : `{ return ${renamedExecBodyNode.getText()}; }`,
  );

  const nangoImport = source.getImportDeclaration('nango');
  const moduleStatements = source
    .getStatements()
    .filter(statement => shouldKeepStatement(statement, createActionCall))
    .map(statement => sanitizeVendoredSource(statement.getText()));

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
      usesProxyConfiguration: Boolean(nangoImport && usesNamedImport(nangoImport, 'ProxyConfiguration')),
      usesNangoActionLocal: moduleStatements.some(statement => /\bNangoActionLocal\b/.test(statement)),
    },
  };
}

function emitActionFile(action: ExtractedAction): string {
  const proxyConfigurationImport = action.usesProxyConfiguration
    ? "import type { NangoRequestConfig as ProxyConfiguration } from '../../../runtime/nango-shim.js';\n"
    : '';
  const nangoContextImport = action.usesNangoActionLocal
    ? "import type { NangoContext } from '../../../runtime/nango-shim.js';\n"
    : '';
  const nangoActionAlias = action.usesNangoActionLocal ? '\ntype NangoActionLocal = NangoContext;\n' : '';

  return `// AUTO-GENERATED from NangoHQ/integration-templates @ ${TEMPLATE_SHA.slice(0, 12)} — do not edit by hand.
import { z } from 'zod';

import { defineActionTool, type ActionToolContext } from '../../../runtime/action-tool.js';
${proxyConfigurationImport}${nangoContextImport}${nangoActionAlias}
${action.moduleStatements.join('\n\n')}

export function ${action.toolFactoryName}(ctx: ActionToolContext) {
  return defineActionTool<z.infer<typeof ${action.inputSchemaName}>, z.infer<typeof ${action.outputSchemaName}>>(ctx, {
    id: '${action.candidate.toolKey}',
    description: ${JSON.stringify(action.description)},
    inputSchema: ${action.inputSchemaName},
    outputSchema: ${action.outputSchemaName},
    exec: async (nango, input) => ${action.execBody},
  });
}
`;
}

function emitToolsFile(integrationId: string, actions: ExtractedAction[]): string {
  const envVar = `MASTRA_${integrationId.replace(/-/g, '_').toUpperCase()}_CONNECTION_ID`;
  const imports = actions
    .map(action => `import { ${action.toolFactoryName} } from './tools/${action.candidate.actionSlug}.js';`)
    .join('\n');
  const toolEntries = actions
    .map(action => `    ${action.candidate.toolKey}: ${action.toolFactoryName}(ctx),`)
    .join('\n');

  return `// AUTO-GENERATED from NangoHQ/integration-templates @ ${TEMPLATE_SHA.slice(0, 12)} — do not edit by hand.
import type { ActionToolContext } from '../../runtime/action-tool.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyAllowTools } from '../../toolset.js';
${imports}

const ENV_VAR = '${envVar}';

export function create${toPascal(integrationId)}Tools(options?: ProviderToolsOptions) {
  const ctx: ActionToolContext = { envVar: ENV_VAR, options };
  const tools = {
${toolEntries}
  };
  return applyAllowTools(tools, options?.allowTools);
}
`;
}

function emitIndexFile(integrationId: string): string {
  const envVar = `MASTRA_${integrationId.replace(/-/g, '_').toUpperCase()}_CONNECTION_ID`;
  const factoryName = `create${toPascal(integrationId)}Tools`;
  return `// AUTO-GENERATED from NangoHQ/integration-templates @ ${TEMPLATE_SHA.slice(0, 12)} — do not edit by hand.
import { PROVIDERS } from '../../registry.js';
import { ${factoryName} } from './tools.js';

PROVIDERS.push({
  integrationId: '${integrationId}',
  envVar: '${envVar}',
  createTools: ${factoryName},
});

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
  expectedTemplateSha = TEMPLATE_SHA,
}: GenerateProviderOptions): Promise<GenerateProviderResult> {
  validateProviderId(providerId, 'Provider ID');
  validateProviderId(localId, 'Local ID');

  const actionDir = resolve(templatesDir, providerId, 'actions');
  if (!existsSync(actionDir)) {
    throw new Error(`Unknown provider '${providerId}'. No actions directory exists in the template checkout.`);
  }

  const templateSha = currentTemplateSha();
  if (templateSha !== expectedTemplateSha) {
    throw new Error(
      `Template checkout is at ${templateSha}, but the generator expects ${expectedTemplateSha}. Run \`pnpm sync-templates\`.`,
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
      writeFileSync(resolve(temporaryDir, 'tools', `${action.candidate.actionSlug}.ts`), emitActionFile(action));
    }
    writeFileSync(resolve(temporaryDir, 'tools.ts'), emitToolsFile(localId, extracted));
    writeFileSync(resolve(temporaryDir, 'index.ts'), emitIndexFile(localId));
    await formatGeneratedFiles(temporaryDir);

    const manifest: ProviderManifest = {
      providerId,
      localId,
      templateSha,
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
