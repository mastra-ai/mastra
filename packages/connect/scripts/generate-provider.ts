#!/usr/bin/env node
/**
 * WIP generator (do not invoke on real providers yet).
 *
 * Generates a shipped provider directory (packages/connect/src/providers/<id>/)
 * from a NangoHQ/integration-templates provider (packages/connect/.templates/
 * integrations/<id>/). Maintainer-only.
 *
 * KNOWN GAP: Every Nango action file declares its own local `InputSchema` /
 * `OutputSchema` / `ProviderResponseSchema` consts. The current extractor
 * emits them into a single `schemas.ts` and dedupes by name, which collapses
 * every action's schemas to whichever action was seen first. Before this
 * generator is safe to invoke on real providers we must rename each action's
 * local schemas to `<actionSlug>_<name>` and rewrite every reference to those
 * names in both the vendored schema declarations and the exec body.
 *
 * The Linear provider at src/providers/linear was hand-written for the
 * vertical slice and does not depend on this generator.
 *
 * Coverage plan (once the naming fix lands): templates whose exec bodies only
 * call methods present on our runtime nango-shim (get/post/put/patch/delete/
 * ActionError/log). Actions that touch getConnection/getMetadata/paginate/
 * setMetadata are skipped with a per-action reason logged. Skipped actions
 * never appear in tools.ts, so the emitted module always type-checks against
 * the current shim.
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
} from 'ts-morph';

import { TEMPLATE_SHA } from './templates-config.js';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const templatesDir = resolve(packageRoot, '.templates', 'integrations');
const providersDir = resolve(packageRoot, 'src', 'providers');

/** Methods available on our NangoContext shim. Any other `nango.*` access disqualifies an action. */
const SHIM_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'ActionError', 'log']);

interface ActionCandidate {
  file: string;
  actionSlug: string; // e.g. 'create-issue' -> tool key stem
  toolKey: string; // e.g. '<provider>_create_issue'
}

interface ExtractedAction {
  candidate: ActionCandidate;
  description: string;
  inputSchemaCode: string;
  outputSchemaCode: string;
  extraSchemas: string; // additional const declarations referenced by input/output/exec
  execBody: string;
  schemaImports: Set<string>; // names to import from ./schemas.js in tools.ts
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

  // Locate the const declarations for input/output and any additional
  // schema const declarations in the same file — we vendor them wholesale.
  const constDecls = new Map<string, string>();
  for (const stmt of source.getStatements()) {
    if (Node.isVariableStatement(stmt)) {
      for (const decl of stmt.getDeclarationList().getDeclarations()) {
        const name = decl.getName();
        const init = decl.getInitializer();
        if (!init) continue;
        // Only vendor schema-like constants (z.object, z.union, z.enum, etc.)
        const text = init.getText();
        if (text.startsWith('z.') || text.includes('z.object(') || text.includes('z.union(')) {
          constDecls.set(name, stmt.getText());
        }
      }
    }
  }
  const inputSchemaCode = constDecls.get(inputName);
  const outputSchemaCode = constDecls.get(outputName);
  if (!inputSchemaCode || !outputSchemaCode) {
    return { kind: 'skip', reason: 'could not locate input/output schema const declarations' };
  }

  // Extract the exec body.
  const execInit = execProp.asKindOrThrow(SyntaxKind.PropertyAssignment).getInitializerOrThrow();
  if (!Node.isArrowFunction(execInit) && !Node.isFunctionExpression(execInit)) {
    return { kind: 'skip', reason: 'exec is not an arrow/function expression' };
  }
  const body = execInit.getBody();
  const bodyText = Node.isBlock(body) ? body.getText() : `{ return ${body.getText()}; }`;

  // Guard: exec must only use shim methods. Any other `nango.*` access disqualifies.
  const nangoAccess = /\bnango\.([A-Za-z_$][\w$]*)/g;
  const usedMethods = new Set<string>();
  for (const match of bodyText.matchAll(nangoAccess)) {
    usedMethods.add(match[1]!);
  }
  const unshimmed = [...usedMethods].filter(m => !SHIM_METHODS.has(m));
  if (unshimmed.length > 0) {
    return { kind: 'skip', reason: `exec uses unshimmed nango methods: ${unshimmed.join(', ')}` };
  }

  // Collect all schema const decls referenced by input/output/exec so schemas.ts is self-contained.
  const referencedSchemas = new Set<string>([inputName, outputName]);
  for (const name of constDecls.keys()) {
    if (bodyText.includes(name) || inputSchemaCode.includes(name) || outputSchemaCode.includes(name)) {
      referencedSchemas.add(name);
    }
  }

  // Emit all referenced schemas in declaration order.
  const orderedSchemaCode: string[] = [];
  for (const stmt of source.getStatements()) {
    if (Node.isVariableStatement(stmt)) {
      for (const decl of stmt.getDeclarationList().getDeclarations()) {
        if (referencedSchemas.has(decl.getName())) {
          // Rewrite `const X = ...` to `export const X = ...` so tools.ts can import.
          const text = stmt.getText().replace(/^const\s+/, 'export const ');
          orderedSchemaCode.push(text);
        }
      }
    }
  }
  const extraSchemas = orderedSchemaCode.join('\n\n');

  return {
    kind: 'ok',
    value: {
      candidate,
      description,
      inputSchemaCode,
      outputSchemaCode,
      extraSchemas,
      execBody: bodyText,
      schemaImports: referencedSchemas,
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
  const header = `// AUTO-GENERATED from NangoHQ/integration-templates @ ${TEMPLATE_SHA.slice(0, 12)} — do not edit by hand.\nimport { z } from 'zod';\n\n`;
  // De-duplicate schema declarations by name across actions.
  const seen = new Set<string>();
  const blocks: string[] = [];
  for (const action of actions) {
    for (const block of action.extraSchemas.split(/\n\n+/)) {
      // Cheap dedupe: use the first identifier after `export const`.
      const match = /export const (\w+)/.exec(block);
      if (!match) continue;
      const name = match[1]!;
      if (seen.has(name)) continue;
      seen.add(name);
      blocks.push(block);
    }
  }
  return header + blocks.join('\n\n') + '\n';
}

function emitToolsFile(integrationId: string, actions: ExtractedAction[]): string {
  const envVar = `MASTRA_${integrationId.replace(/-/g, '_').toUpperCase()}_CONNECTION_ID`;
  const allSchemaNames = new Set<string>();
  for (const a of actions) for (const n of a.schemaImports) allSchemaNames.add(n);

  const importList = [...allSchemaNames].sort().join(', ');
  const factoriesCode = actions
    .map(a => {
      const factoryName = `make${toPascal(a.candidate.actionSlug)}`;
      // schemaImports is a Set built with input first, then output, then extras
      // (see extractAction). Iterating a Set preserves insertion order in modern JS.
      const declared = [...a.schemaImports];
      const inputSchema = declared[0]!;
      const outputSchema = declared[1]!;
      return `function ${factoryName}(ctx: ActionToolContext) {
  return defineActionTool<z.infer<typeof ${inputSchema}>, z.infer<typeof ${outputSchema}>>(ctx, {
    id: '${a.candidate.toolKey}',
    description: ${JSON.stringify(a.description)},
    inputSchema: ${inputSchema},
    outputSchema: ${outputSchema},
    exec: async (nango, input) => ${a.execBody},
  });
}`;
    })
    .join('\n\n');

  const toolMapEntries = actions
    .map(a => `    ${a.candidate.toolKey}: make${toPascal(a.candidate.actionSlug)}(ctx),`)
    .join('\n');

  return `// AUTO-GENERATED from NangoHQ/integration-templates @ ${TEMPLATE_SHA.slice(0, 12)} — do not edit by hand.
import type { z } from 'zod';

import { defineActionTool, type ActionToolContext } from '../../runtime/action-tool.js';
import type { ProviderToolsOptions } from '../../toolset.js';
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
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

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
