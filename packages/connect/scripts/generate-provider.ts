#!/usr/bin/env node
/**
 * Generates a shipped provider directory (packages/connect/src/providers/<id>/)
 * from a NangoHQ/integration-templates provider (packages/connect/.templates/
 * integrations/<id>/). Maintainer-only.
 *
 * Design note — schema namespacing: every Nango action file typically declares
 * its own local `InputSchema` / `OutputSchema` / `ProviderResponseSchema` /
 * etc. Concatenating those consts across actions would collide on name, so
 * the extractor renames every top-level schema const in a source file to
 * `<actionCamel>_<OriginalName>` and rewrites references in both the vendored
 * schema declarations and the exec body. That gives us a self-consistent
 * `schemas.ts` per provider and a `tools.ts` that imports the namespaced
 * names directly.
 *
 * Coverage: templates whose exec bodies only call methods present on our
 * runtime nango-shim (get/post/put/patch/delete/ActionError/log). Actions
 * that touch getConnection/getMetadata/paginate/setMetadata are skipped
 * with a per-action reason logged, so the emitted module always type-checks
 * against the current shim.
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  Node,
  Project,
  SyntaxKind,
  type CallExpression,
  type ObjectLiteralExpression,
  type SourceFile,
  type VariableDeclaration,
} from 'ts-morph';

import { TEMPLATE_SHA } from './templates-config.js';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const templatesDir = resolve(packageRoot, '.templates', 'integrations');
const providersDir = resolve(packageRoot, 'src', 'providers');

/** Methods available on our NangoContext shim. Any other `nango.*` access disqualifies an action. */
const SHIM_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'ActionError', 'log']);

interface ActionCandidate {
  file: string;
  actionSlug: string; // 'create-issue'
  toolKey: string; // '<provider>_create_issue'
}

/** One vendored schema const, with its original name in the source file and the namespaced export name. */
interface VendoredSchema {
  originalName: string;
  exportedName: string;
  code: string; // full `export const <exportedName> = <rhs>;` statement
}

interface ExtractedAction {
  candidate: ActionCandidate;
  description: string;
  inputExportedName: string;
  outputExportedName: string;
  vendoredSchemas: VendoredSchema[];
  execBody: string;
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

/** Reads an action file, extracts what we need, or returns a skip reason. */
function extractAction(
  project: Project,
  candidate: ActionCandidate,
): { kind: 'ok'; value: ExtractedAction } | { kind: 'skip'; reason: string } {
  const source: SourceFile = project.addSourceFileAtPath(candidate.file);
  const createActionCall = findCreateActionCall(source);
  if (!createActionCall) return { kind: 'skip', reason: 'no createAction() call found' };

  const arg = createActionCall.getArguments()[0];
  if (!arg || !Node.isObjectLiteralExpression(arg)) {
    return { kind: 'skip', reason: 'createAction argument is not an object literal' };
  }
  const config = arg;

  const description = readStringProperty(config, 'description') ?? '';
  const inputProp = config.getProperty('input');
  const outputProp = config.getProperty('output');
  const execProp = config.getProperty('exec');
  if (!inputProp || !outputProp || !execProp) {
    return { kind: 'skip', reason: 'missing input/output/exec in createAction' };
  }

  const inputName = readIdentifierPropertyInitializer(config, 'input');
  const outputName = readIdentifierPropertyInitializer(config, 'output');
  if (!inputName || !outputName) {
    return { kind: 'skip', reason: 'input/output are not simple identifier references (schemas expected as const)' };
  }

  // Extract exec body before renaming so we can validate nango method usage
  // and discover top-level declarations referenced by the implementation.
  const execInit = execProp.asKindOrThrow(SyntaxKind.PropertyAssignment).getInitializerOrThrow();
  if (!Node.isArrowFunction(execInit) && !Node.isFunctionExpression(execInit)) {
    return { kind: 'skip', reason: 'exec is not an arrow/function expression' };
  }
  const body = execInit.getBody();
  const originalBodyText = Node.isBlock(body) ? body.getText() : `{ return ${body.getText()}; }`;

  // Guard: exec must only use shim-supported nango.* methods.
  const nangoAccess = /\bnango\.([A-Za-z_$][\w$]*)/g;
  const usedMethods = new Set<string>();
  for (const match of originalBodyText.matchAll(nangoAccess)) usedMethods.add(match[1]!);
  const unshimmed = [...usedMethods].filter(m => !SHIM_METHODS.has(m));
  if (unshimmed.length > 0) {
    return { kind: 'skip', reason: `exec uses unshimmed nango methods: ${unshimmed.join(', ')}` };
  }

  // Index every top-level const. Starting from the input/output schemas and
  // identifiers referenced by exec, walk initializer dependencies recursively.
  // This handles aliases such as `const OutputSchema = ModelSchema` as well as
  // nested schema graphs without relying on fragile `z.*` text heuristics.
  const topLevelDecls = new Map<string, VariableDeclaration>();
  const declarationOrder: string[] = [];
  for (const stmt of source.getVariableStatements()) {
    const declarations = stmt.getDeclarations();
    if (declarations.length !== 1) {
      return { kind: 'skip', reason: 'top-level variable statement contains multiple declarations' };
    }
    const decl = declarations[0]!;
    if (!decl.getInitializer()) continue;
    topLevelDecls.set(decl.getName(), decl);
    declarationOrder.push(decl.getName());
  }

  if (!topLevelDecls.has(inputName) || !topLevelDecls.has(outputName)) {
    return { kind: 'skip', reason: 'could not locate input/output schema const declarations' };
  }

  const includedNames = new Set<string>([inputName, outputName]);
  for (const identifier of body.getDescendantsOfKind(SyntaxKind.Identifier)) {
    const name = identifier.getText();
    if (topLevelDecls.has(name)) includedNames.add(name);
  }

  const pending = [...includedNames];
  while (pending.length > 0) {
    const name = pending.pop()!;
    const initializer = topLevelDecls.get(name)?.getInitializer();
    if (!initializer) continue;
    for (const identifier of initializer.getDescendantsOfKind(SyntaxKind.Identifier)) {
      const dependency = identifier.getText();
      if (topLevelDecls.has(dependency) && !includedNames.has(dependency)) {
        includedNames.add(dependency);
        pending.push(dependency);
      }
    }
  }

  // Use ts-morph's symbol-aware rename rather than text substitution. This
  // rewrites identifier references without touching string literals, comments,
  // property keys, or substrings in unrelated identifiers.
  const actionCamel = toCamel(candidate.actionSlug);
  const renames = new Map<string, string>();
  for (const name of declarationOrder) {
    if (!includedNames.has(name)) continue;
    renames.set(name, `${actionCamel}_${name}`);
  }
  for (const [name, exportedName] of renames) {
    topLevelDecls.get(name)!.rename(exportedName);
  }

  const vendoredSchemas: VendoredSchema[] = declarationOrder
    .filter(name => includedNames.has(name))
    .map(originalName => {
      const exportedName = renames.get(originalName)!;
      const statementText = topLevelDecls.get(originalName)!.getVariableStatementOrThrow().getText();
      return {
        originalName,
        exportedName,
        code: statementText.replace(/^const\s+/, 'export const '),
      };
    });

  const renamedBody = execInit.getBody();
  const execBody = Node.isBlock(renamedBody) ? renamedBody.getText() : `{ return ${renamedBody.getText()}; }`;

  return {
    kind: 'ok',
    value: {
      candidate,
      description,
      inputExportedName: renames.get(inputName)!,
      outputExportedName: renames.get(outputName)!,
      vendoredSchemas,
      execBody,
    },
  };
}

function findCreateActionCall(source: SourceFile): CallExpression | undefined {
  for (const call of source.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expr = call.getExpression();
    if (Node.isIdentifier(expr) && expr.getText() === 'createAction') return call;
  }
  return undefined;
}

function readStringProperty(obj: ObjectLiteralExpression, name: string): string | undefined {
  const prop = obj.getProperty(name);
  if (!prop || !Node.isPropertyAssignment(prop)) return undefined;
  const init = prop.getInitializer();
  if (init && Node.isStringLiteral(init)) return init.getLiteralValue();
  return undefined;
}

function readIdentifierPropertyInitializer(obj: ObjectLiteralExpression, name: string): string | undefined {
  const prop = obj.getProperty(name);
  if (!prop || !Node.isPropertyAssignment(prop)) return undefined;
  const init = prop.getInitializer();
  if (init && Node.isIdentifier(init)) return init.getText();
  return undefined;
}

function emitSchemasFile(actions: ExtractedAction[]): string {
  const header = `// AUTO-GENERATED from NangoHQ/integration-templates @ ${TEMPLATE_SHA.slice(0, 12)} — do not edit by hand.\nimport { z } from 'zod';\n`;
  const blocks: string[] = [];
  for (const action of actions) {
    blocks.push(`\n// —— ${action.candidate.actionSlug} ——`);
    for (const schema of action.vendoredSchemas) {
      blocks.push(schema.code);
    }
  }
  return header + blocks.join('\n\n') + '\n';
}

function emitToolsFile(integrationId: string, actions: ExtractedAction[]): string {
  const envVar = `MASTRA_${integrationId.replace(/-/g, '_').toUpperCase()}_CONNECTION_ID`;
  const allSchemaNames = new Set<string>();
  for (const a of actions) for (const s of a.vendoredSchemas) allSchemaNames.add(s.exportedName);

  const importList = [...allSchemaNames].sort().join(', ');
  const proxyConfigurationImport = actions.some(action => /\bProxyConfiguration\b/.test(action.execBody))
    ? "import type { NangoRequestConfig as ProxyConfiguration } from '../../runtime/nango-shim.js';\n"
    : '';
  const factoriesCode = actions
    .map(
      a => `function make${toPascal(a.candidate.actionSlug)}(ctx: ActionToolContext) {
  return defineActionTool<z.infer<typeof ${a.inputExportedName}>, z.infer<typeof ${a.outputExportedName}>>(ctx, {
    id: '${a.candidate.toolKey}',
    description: ${JSON.stringify(a.description)},
    inputSchema: ${a.inputExportedName},
    outputSchema: ${a.outputExportedName},
    exec: async (nango, input) => ${a.execBody},
  });
}`,
    )
    .join('\n\n');

  const toolMapEntries = actions
    .map(a => `    ${a.candidate.toolKey}: make${toPascal(a.candidate.actionSlug)}(ctx),`)
    .join('\n');

  return `// AUTO-GENERATED from NangoHQ/integration-templates @ ${TEMPLATE_SHA.slice(0, 12)} — do not edit by hand.
import type { z } from 'zod';

import { defineActionTool, type ActionToolContext } from '../../runtime/action-tool.js';
${proxyConfigurationImport}import type { ProviderToolsOptions } from '../../toolset.js';
import { applyAllowTools } from '../../toolset.js';
import { ${importList} } from './schemas.js';

const ENV_VAR = '${envVar}';

${factoriesCode}

export function create${toPascal(integrationId)}Tools(options?: ProviderToolsOptions) {
  const ctx: ActionToolContext = { envVar: ENV_VAR, options };
  const tools = {
${toolMapEntries}
  };
  return applyAllowTools(tools, options?.allowTools);
}
`;
}

function emitIndexFile(integrationId: string): string {
  const envVar = `MASTRA_${integrationId.replace(/-/g, '_').toUpperCase()}_CONNECTION_ID`;
  const factoryName = `create${toPascal(integrationId)}Tools`;
  return `// AUTO-GENERATED from NangoHQ/integration-templates @ ${TEMPLATE_SHA.slice(0, 12)} — do not edit by hand.
// Side-effect: registers the ${integrationId} provider with the PROVIDERS registry on import.
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

function main(): void {
  const [, , integrationId] = process.argv;
  if (!integrationId) usage();

  const providerTemplateDir = resolve(templatesDir, integrationId, 'actions');
  if (!existsSync(providerTemplateDir)) {
    console.error(`No template actions dir at ${providerTemplateDir} — run \`pnpm sync-templates\` first.`);
    process.exit(1);
  }

  const actionFiles = readdirSync(providerTemplateDir)
    .filter(f => f.endsWith('.ts'))
    .map(f => resolve(providerTemplateDir, f));

  const project = new Project({ useInMemoryFileSystem: false, skipAddingFilesFromTsConfig: true });
  const extracted: ExtractedAction[] = [];
  const skipped: SkippedAction[] = [];

  for (const file of actionFiles) {
    const actionSlug = file.split('/').pop()!.replace(/\.ts$/, '');
    const toolKey = `${integrationId.replace(/-/g, '_')}_${toSnake(actionSlug)}`;
    const candidate: ActionCandidate = { file, actionSlug, toolKey };
    const result = extractAction(project, candidate);
    if (result.kind === 'ok') extracted.push(result.value);
    else skipped.push({ candidate, reason: result.reason });
  }

  if (extracted.length === 0) {
    console.error(`No usable actions found for ${integrationId}. Skipped:`);
    for (const s of skipped) console.error(`  - ${s.candidate.actionSlug}: ${s.reason}`);
    process.exit(1);
  }

  const outputDir = resolve(providersDir, integrationId);
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  writeFileSync(resolve(outputDir, 'schemas.ts'), emitSchemasFile(extracted));
  writeFileSync(resolve(outputDir, 'tools.ts'), emitToolsFile(integrationId, extracted));
  writeFileSync(resolve(outputDir, 'index.ts'), emitIndexFile(integrationId));

  console.log(`✓ Generated ${integrationId} (${extracted.length} tools, ${skipped.length} skipped)`);
  if (skipped.length > 0) {
    console.log('  Skipped:');
    for (const s of skipped) console.log(`    - ${s.candidate.actionSlug}: ${s.reason}`);
  }
  console.log(`\nNext: add \`import './${integrationId}/index.js';\` to src/providers/index.ts`);
}

main();
