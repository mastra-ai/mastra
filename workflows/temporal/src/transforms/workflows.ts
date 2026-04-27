import { readFileSync, statSync } from 'node:fs';
import path, { join } from 'node:path';
import { generate } from '@babel/generator';
import { parse } from '@babel/parser';
import * as t from '@babel/types';
import { toWorkflowType } from '../utils';
import type { WorkflowImportBinding } from './shared';
import {
  collectImportedNames,
  getCreateStepId,
  getObjectPropertyName,
  isCreateWorkflowCall,
  isIdentifierNamed,
  isStrippedExternalModule,
  isTemporalHelperModule,
  isWorkflowHelperDestructure,
  nodeReferencesName,
  parserPlugins,
  pruneUnusedTopLevelBindings,
  transpileModule,
  walk,
} from './shared';

/**
 * Builds a lookup table for imports in the entry module so we can connect a workflow
 * identifier used inside `new Mastra({ workflows })` back to its import source.
 */
function getWorkflowImportBindings(program: t.Program): Map<string, WorkflowImportBinding> {
  const bindings = new Map<string, WorkflowImportBinding>();

  for (const statement of program.body) {
    if (!t.isImportDeclaration(statement)) {
      continue;
    }

    for (const specifier of statement.specifiers) {
      if (t.isImportSpecifier(specifier)) {
        bindings.set(specifier.local.name, {
          exportName: specifier.local.name,
          importedName: t.isIdentifier(specifier.imported) ? specifier.imported.name : specifier.imported.value,
          source: statement.source.value,
        });
        continue;
      }

      if (t.isImportDefaultSpecifier(specifier)) {
        bindings.set(specifier.local.name, {
          exportName: specifier.local.name,
          importedName: 'default',
          source: statement.source.value,
        });
      }
    }
  }

  return bindings;
}

/**
 * Finds the workflow bindings referenced from `new Mastra({ workflows })`.
 *
 * We only care about the local identifiers here. The actual exported workflow names
 * are resolved later from the transformed workflow modules via the shared registry.
 */
function getWorkflowEntryBindings(program: t.Program): Set<string> {
  const workflowBindings = new Set<string>();

  walk(program, node => {
    if (!t.isNewExpression(node) || !isIdentifierNamed(node.callee, 'Mastra')) {
      return;
    }

    const [config] = node.arguments;
    if (!t.isObjectExpression(config)) {
      return;
    }

    const workflowsProperty = config.properties.find(
      (property): property is t.ObjectProperty =>
        t.isObjectProperty(property) && getObjectPropertyName(property) === 'workflows',
    );

    if (!workflowsProperty || !t.isObjectExpression(workflowsProperty.value)) {
      return;
    }

    for (const property of workflowsProperty.value.properties) {
      if (!t.isObjectProperty(property)) {
        continue;
      }

      if (property.shorthand && t.isIdentifier(property.key)) {
        workflowBindings.add(property.key.name);
        continue;
      }

      if (t.isIdentifier(property.value)) {
        workflowBindings.add(property.value.name);
      }
    }
  });

  return workflowBindings;
}

/**
 * Temporal workflow types must be static so the loader can deterministically map
 * a source workflow to the runtime export name used by the worker.
 */
function getWorkflowIdMetadata(
  workflowConfig: t.ObjectExpression,
  workflowName: string,
  filePath: string,
): { expression: t.Expression; workflowId: string } {
  for (const property of workflowConfig.properties) {
    if (!t.isObjectProperty(property) || getObjectPropertyName(property) !== 'id') {
      continue;
    }

    if (!t.isExpression(property.value)) {
      break;
    }

    if (t.isStringLiteral(property.value)) {
      return {
        expression: t.cloneNode(property.value, true),
        workflowId: property.value.value,
      };
    }

    if (t.isTemplateLiteral(property.value) && property.value.expressions.length === 0) {
      return {
        expression: t.cloneNode(property.value, true),
        workflowId: property.value.quasis[0]?.value.cooked ?? '',
      };
    }

    throw new Error(`Workflow id must be a static string for ${workflowName} in ${filePath}`);
  }

  throw new Error(`Unable to determine workflow id for ${workflowName} in ${filePath}`);
}

/**
 * The helper runtime lives in its own `.mjs` module so it can be linted and unit-tested
 * like normal code. We parse that file directly here instead of using `Function#toString()`,
 * which keeps fixture output stable under Vitest/Vite instrumentation.
 */
function createTemporalWorkflowHelperStatements(): t.Statement[] {
  let temporalWorkflowRuntimeSource = readFileSync(join(__dirname, './temporal-workflow-runtime.mjs'), 'utf8');

  const helperProgram = parse(temporalWorkflowRuntimeSource, {
    sourceType: 'module',
    plugins: parserPlugins as any,
  }).program.body;

  return helperProgram.flatMap(statement => {
    if (t.isExportNamedDeclaration(statement) && statement.declaration) {
      return [statement.declaration];
    }

    return [statement];
  });
}

/**
 * Walks a chained workflow expression like `createWorkflow(...).then(...).commit()`
 * back to its root `createWorkflow(...)` call while preserving method order.
 */
function parseWorkflowChain(
  node: t.Node,
): { createWorkflowCall: t.CallExpression; methods: { name: string; args: t.Node[] }[] } | null {
  const methods: { name: string; args: t.Node[] }[] = [];
  let current: t.Node = node;

  // Example:
  //   createWorkflow(...).then(stepA).sleep(1000).commit()
  // is peeled from the outside in, producing:
  //   [then(stepA), sleep(1000), commit()]
  while (t.isCallExpression(current) && t.isMemberExpression(current.callee) && !current.callee.computed) {
    if (!t.isIdentifier(current.callee.property)) {
      return null;
    }

    methods.unshift({
      name: current.callee.property.name,
      args: current.arguments as t.Node[],
    });
    current = current.callee.object;
  }

  if (!isCreateWorkflowCall(current)) {
    return null;
  }

  return {
    createWorkflowCall: current,
    methods,
  };
}

/**
 * Maps local `const someStep = createStep({ id: 'some-step' })` bindings to their
 * runtime ids so later chain rewriting can replace identifier references with ids.
 */
function collectStepBindings(program: t.Program): Map<string, string> {
  const stepBindings = new Map<string, string>();

  for (const statement of program.body) {
    if (
      !t.isVariableDeclaration(statement) &&
      !(t.isExportNamedDeclaration(statement) && t.isVariableDeclaration(statement.declaration))
    ) {
      continue;
    }

    const declarationStatement = t.isVariableDeclaration(statement)
      ? statement
      : (statement.declaration as t.VariableDeclaration);

    for (const declaration of declarationStatement.declarations) {
      if (!t.isIdentifier(declaration.id) || !declaration.init) {
        continue;
      }

      const stepId = getCreateStepId(declaration.init);
      if (stepId) {
        stepBindings.set(declaration.id.name, stepId);
      }
    }
  }

  return stepBindings;
}

/**
 * Accepts the few AST node shapes we allow as "step references" in workflow chains
 * and normalizes them to a single step id string.
 */
function getWorkflowStepName(node: t.Node | null | undefined, stepBindings: Map<string, string>): string | null {
  if (!node) {
    return null;
  }

  if (t.isIdentifier(node)) {
    return stepBindings.get(node.name) ?? node.name;
  }

  if (t.isStringLiteral(node)) {
    return node.value;
  }

  return getCreateStepId(node);
}

/**
 * Normalizes fluent workflow builder calls into the simpler Temporal runtime shape.
 *
 * Most step references collapse down to step ids so the generated workflow can call
 * activities by id instead of keeping the original `createStep` definitions around.
 */
function rewriteChainMethod(
  method: { name: string; args: t.Node[] },
  filePath: string,
  workflowName: string,
  stepBindings: Map<string, string>,
): t.Expression[] {
  const argNode = (index: number): t.Node | undefined => method.args[index];

  // Each case translates an AST representation of a builder call into the exact
  // argument list expected by our lightweight runtime helper.
  switch (method.name) {
    case 'then': {
      const name = getWorkflowStepName(argNode(0), stepBindings);
      if (!name) {
        throw new Error(
          `.then() in ${workflowName} (${filePath}) must take a step identifier (inline createStep calls are not supported)`,
        );
      }
      return [t.stringLiteral(name)];
    }

    case 'sleep': {
      const arg = argNode(0);
      if (t.isNumericLiteral(arg)) {
        return [t.cloneNode(arg, true)];
      }
      const name = getWorkflowStepName(arg, stepBindings);
      if (!name) {
        throw new Error(`.sleep() in ${workflowName} (${filePath}) must be a numeric literal or an identifier`);
      }
      return [t.stringLiteral(name)];
    }

    case 'sleepUntil': {
      const arg = argNode(0);
      if (t.isNewExpression(arg) && t.isIdentifier(arg.callee) && arg.callee.name === 'Date') {
        return [t.cloneNode(arg, true)];
      }
      if (t.isStringLiteral(arg) || t.isNumericLiteral(arg)) {
        return [t.cloneNode(arg, true)];
      }
      const name = getWorkflowStepName(arg, stepBindings);
      if (!name) {
        throw new Error(
          `.sleepUntil() in ${workflowName} (${filePath}) must be a Date, string/number literal, or an identifier`,
        );
      }
      return [t.stringLiteral(name)];
    }

    case 'parallel': {
      const arg = argNode(0);
      if (!t.isArrayExpression(arg)) {
        throw new Error(`.parallel() in ${workflowName} (${filePath}) requires an array literal argument`);
      }
      const names = arg.elements.map(el => getWorkflowStepName(el, stepBindings));
      if (names.some(n => !n)) {
        throw new Error(`Unable to determine step names inside .parallel() in ${workflowName} (${filePath})`);
      }
      return [t.arrayExpression(names.map(n => t.stringLiteral(n!)))];
    }

    case 'branch': {
      const arg = argNode(0);
      if (!t.isArrayExpression(arg)) {
        throw new Error(
          `.branch() in ${workflowName} (${filePath}) requires an array literal of [condition, step] pairs`,
        );
      }
      const pairs = arg.elements.map(pair => {
        if (!t.isArrayExpression(pair) || pair.elements.length !== 2) {
          throw new Error(
            `.branch() pair in ${workflowName} (${filePath}) must be a 2-element array [condition, step]`,
          );
        }
        const condName = getWorkflowStepName(pair.elements[0], stepBindings);
        const stepName = getWorkflowStepName(pair.elements[1], stepBindings);
        if (!condName || !stepName) {
          throw new Error(`.branch() condition and step in ${workflowName} (${filePath}) must be identifiers`);
        }
        return t.arrayExpression([t.stringLiteral(condName), t.stringLiteral(stepName)]);
      });
      return [t.arrayExpression(pairs)];
    }

    case 'dowhile':
    case 'dountil': {
      const stepName = getWorkflowStepName(argNode(0), stepBindings);
      const condName = getWorkflowStepName(argNode(1), stepBindings);
      if (!stepName || !condName) {
        throw new Error(`.${method.name}() in ${workflowName} (${filePath}) must take (step, condition) identifiers`);
      }
      return [t.stringLiteral(stepName), t.stringLiteral(condName)];
    }

    case 'foreach': {
      const stepName = getWorkflowStepName(argNode(0), stepBindings);
      if (!stepName) {
        throw new Error(`.foreach() in ${workflowName} (${filePath}) must take a step identifier`);
      }
      const args: t.Expression[] = [t.stringLiteral(stepName)];
      const optsArg = method.args[1];
      if (optsArg && t.isExpression(optsArg)) {
        args.push(t.cloneNode(optsArg, true));
      }
      return args;
    }

    case 'commit':
      return [];

    default:
      throw new Error(`Unsupported workflow chain method .${method.name}() in ${workflowName} (${filePath})`);
  }
}

function getExportedName(node: t.Identifier | t.StringLiteral): string {
  return t.isIdentifier(node) ? node.name : node.value;
}

/**
 * Materializes one transformed workflow export.
 *
 * Instead of preserving the original `const workflow = createWorkflow(...)` shape,
 * we emit a deterministic exported function whose name matches Temporal's runtime
 * lookup and whose body delegates into the injected helper runtime.
 */
function createTemporalWorkflowStatements(
  exportName: string,
  workflowId: t.Expression,
  methods: { name: string; args: t.Node[] }[],
  filePath: string,
  includeCommit: boolean,
  exportInline: boolean,
  stepBindings: Map<string, string>,
): t.Statement[] {
  // Start from `createWorkflow(<static id>)` and rebuild the chain one call at a time
  // using normalized arguments from `rewriteChainMethod`.
  let expression: t.Expression = t.callExpression(t.identifier('createWorkflow'), [t.cloneNode(workflowId, true)]);

  for (const method of methods) {
    const newArgs = rewriteChainMethod(method, filePath, exportName, stepBindings);
    expression = t.callExpression(t.memberExpression(expression, t.identifier(method.name)), newArgs);
  }

  if (includeCommit && !methods.some(m => m.name === 'commit')) {
    expression = t.callExpression(t.memberExpression(expression, t.identifier('commit')), []);
  }

  const argsParam = t.identifier('args');
  // Temporal loads workflows by exported symbol name, so we wrap the rebuilt graph
  // in a named exported function instead of leaving the original builder object.
  const lambda = t.arrowFunctionExpression(
    [argsParam],
    t.blockStatement([t.returnStatement(t.callExpression(expression, [t.identifier('args')]))]),
  );

  const declaration = t.variableDeclaration('const', [t.variableDeclarator(t.identifier(exportName), lambda)]);

  return [exportInline ? t.exportNamedDeclaration(declaration) : declaration];
}

export interface BuildTemporalWorkflowOptions {
  /** Reserved for future loader options. */
}

export interface TemporalWorkflowExport {
  exportName: string;
  workflowId: string;
}

export interface BuildTemporalWorkflowModuleResult {
  code: string;
  workflows: TemporalWorkflowExport[];
}

function getTemporalWorkflowExportFromDeclaration(
  declaration: t.VariableDeclarator,
  filePath: string,
): TemporalWorkflowExport | null {
  if (!t.isIdentifier(declaration.id) || !declaration.init) {
    return null;
  }

  const workflowChain = parseWorkflowChain(declaration.init);
  if (!workflowChain) {
    return null;
  }

  const [workflowConfig] = workflowChain.createWorkflowCall.arguments;
  if (!workflowConfig || !t.isObjectExpression(workflowConfig)) {
    throw new Error(`Unable to determine workflow config for ${declaration.id.name} in ${filePath}`);
  }

  const { workflowId } = getWorkflowIdMetadata(workflowConfig, declaration.id.name, filePath);
  return {
    exportName: toWorkflowType(workflowId),
    workflowId,
  };
}

export function collectTemporalWorkflowExports(sourceText: string, filePath: string): TemporalWorkflowExport[] {
  const ast = parseWorkflowModuleAst(sourceText, filePath);
  const workflowExports: TemporalWorkflowExport[] = [];

  for (const statement of ast.program.body) {
    const declarationStatement = getVariableDeclarationFromStatement(statement);
    if (!declarationStatement) {
      continue;
    }

    for (const declaration of declarationStatement.declarations) {
      const workflowExport = getTemporalWorkflowExportFromDeclaration(declaration, filePath);
      if (workflowExport) {
        workflowExports.push(workflowExport);
      }
    }
  }

  return workflowExports;
}

/**
 * Rewrites the Mastra entry file into pure re-exports so webpack only walks workflow
 * modules from the entrypoint.
 */
export async function buildWorkflowEntryModuleFromRegistry(
  sourceText: string,
  filePath: string,
  registry: Map<string, string[]>,
): Promise<string> {
  const ast = parse(sourceText, {
    sourceType: 'module',
    plugins: parserPlugins as any,
    sourceFilename: filePath,
  });

  const workflowBindings = getWorkflowEntryBindings(ast.program);
  const importBindings = getWorkflowImportBindings(ast.program);
  const exportStatements: t.ExportNamedDeclaration[] = [];
  const seenExports = new Set<string>();

  for (const workflowBinding of workflowBindings) {
    const importedBinding = importBindings.get(workflowBinding);
    if (!importedBinding) {
      throw new Error(`Unable to find an import for workflow '${workflowBinding}' in ${filePath}`);
    }

    const workflowPath = resolveWorkflowPathSync(importedBinding.source, filePath);
    const exportNames = registry.get(workflowPath);
    if (!exportNames || exportNames.length === 0) {
      throw new Error(`Unable to find registered workflow exports for ${workflowPath}`);
    }

    for (const exportName of exportNames) {
      const exportKey = `${importedBinding.source}:${exportName}`;
      if (seenExports.has(exportKey)) {
        continue;
      }

      seenExports.add(exportKey);
      exportStatements.push(
        t.exportNamedDeclaration(
          null,
          [t.exportSpecifier(t.identifier(exportName), t.identifier(exportName))],
          t.stringLiteral(importedBinding.source),
        ),
      );
    }
  }

  return generate(t.file(t.program(exportStatements, [], 'module')), {
    sourceMaps: false,
  }).code;
}

function parseWorkflowModuleAst(sourceText: string, filePath: string): t.File {
  return parse(sourceText, {
    sourceType: 'module',
    plugins: parserPlugins as any,
    sourceFilename: filePath,
  });
}

function getVariableDeclarationFromStatement(statement: t.Statement): t.VariableDeclaration | null {
  if (t.isVariableDeclaration(statement)) {
    return statement;
  }

  if (t.isExportNamedDeclaration(statement) && t.isVariableDeclaration(statement.declaration)) {
    return statement.declaration;
  }

  return null;
}

function getCommittedWorkflowName(statement: t.Statement): string | null {
  if (!t.isExpressionStatement(statement)) {
    return null;
  }

  const { expression } = statement;
  if (
    !t.isCallExpression(expression) ||
    !t.isMemberExpression(expression.callee) ||
    expression.callee.computed ||
    !isIdentifierNamed(expression.callee.property, 'commit') ||
    !t.isIdentifier(expression.callee.object)
  ) {
    return null;
  }

  return expression.callee.object.name;
}

interface WorkflowTransformState {
  statements: t.Statement[];
  workflowNames: Set<string>;
  generatedWorkflowNames: Set<string>;
  committedWorkflowNames: Set<string>;
  committedGeneratedWorkflowNames: Set<string>;
  inlineExportedWorkflowNames: Set<string>;
  strippedNames: Set<string>;
  stepBindings: Map<string, string>;
  workflowExports: TemporalWorkflowExport[];
}

function createWorkflowTransformState(program: t.Program): WorkflowTransformState {
  return {
    statements: [...createTemporalWorkflowHelperStatements()],
    workflowNames: new Set<string>(),
    generatedWorkflowNames: new Set<string>(),
    committedWorkflowNames: new Set<string>(),
    committedGeneratedWorkflowNames: new Set<string>(),
    inlineExportedWorkflowNames: new Set<string>(),
    strippedNames: new Set<string>(),
    stepBindings: collectStepBindings(program),
    workflowExports: [],
  };
}

function collectWorkflowDeclarationMetadata(statement: t.Statement, state: WorkflowTransformState): void {
  const declarationStatement = getVariableDeclarationFromStatement(statement);
  if (!declarationStatement) {
    return;
  }

  for (const declaration of declarationStatement.declarations) {
    if (!t.isIdentifier(declaration.id) || !declaration.init) {
      continue;
    }

    if (!parseWorkflowChain(declaration.init)) {
      continue;
    }

    state.workflowNames.add(declaration.id.name);
    if (t.isExportNamedDeclaration(statement)) {
      state.inlineExportedWorkflowNames.add(declaration.id.name);
    }
  }
}

function collectWorkflowExportMetadata(statement: t.Statement, state: WorkflowTransformState): void {
  if (t.isExportNamedDeclaration(statement) && statement.declaration == null && statement.source == null) {
    for (const specifier of statement.specifiers) {
      if (!t.isExportSpecifier(specifier) || !t.isIdentifier(specifier.local)) {
        continue;
      }

      if (!state.workflowNames.has(specifier.local.name)) {
        continue;
      }

      if (getExportedName(specifier.exported) === specifier.local.name) {
        state.inlineExportedWorkflowNames.add(specifier.local.name);
      }
    }
  }
}

function collectWorkflowTransformMetadata(program: t.Program, state: WorkflowTransformState): void {
  for (const statement of program.body) {
    collectWorkflowDeclarationMetadata(statement, state);

    const committedWorkflowName = getCommittedWorkflowName(statement);
    if (committedWorkflowName) {
      state.committedWorkflowNames.add(committedWorkflowName);
    }

    collectWorkflowExportMetadata(statement, state);
  }
}

function rewriteWorkflowImportDeclaration(statement: t.ImportDeclaration, state: WorkflowTransformState): void {
  if (statement.source.value === '@mastra/core/workflows') {
    const retainedSpecifiers = statement.specifiers.filter(
      specifier =>
        !(
          t.isImportSpecifier(specifier) &&
          t.isIdentifier(specifier.imported) &&
          (specifier.imported.name === 'createWorkflow' || specifier.imported.name === 'createStep')
        ),
    );

    if (retainedSpecifiers.length > 0) {
      state.statements.push(t.importDeclaration(retainedSpecifiers, t.stringLiteral(statement.source.value)));
    }
    return;
  }

  if (isTemporalHelperModule(statement.source.value) || isStrippedExternalModule(statement.source.value)) {
    for (const name of collectImportedNames(statement)) {
      state.strippedNames.add(name);
    }
    return;
  }

  state.statements.push(statement);
}

function rewriteWorkflowNamedExport(statement: t.ExportNamedDeclaration, state: WorkflowTransformState): void {
  if (statement.source != null) {
    state.statements.push(statement);
    return;
  }

  const retainedSpecifiers = statement.specifiers.filter(specifier => {
    if (!t.isExportSpecifier(specifier) || !t.isIdentifier(specifier.local)) {
      return true;
    }

    if (!state.workflowNames.has(specifier.local.name)) {
      return true;
    }

    return getExportedName(specifier.exported) !== specifier.local.name;
  });

  if (retainedSpecifiers.length > 0) {
    state.statements.push(t.exportNamedDeclaration(null, retainedSpecifiers));
  }
}

function rewriteWorkflowVariableDeclaration(
  statement: t.Statement,
  filePath: string,
  state: WorkflowTransformState,
): void {
  const declarationStatement = getVariableDeclarationFromStatement(statement);
  if (!declarationStatement) {
    return;
  }

  const declarations: t.VariableDeclarator[] = [];

  for (const declaration of declarationStatement.declarations) {
    if (isWorkflowHelperDestructure(declaration)) {
      continue;
    }

    if (t.isIdentifier(declaration.id) && state.stepBindings.has(declaration.id.name)) {
      state.strippedNames.add(declaration.id.name);
      continue;
    }

    if (!t.isIdentifier(declaration.id) || !declaration.init) {
      declarations.push(declaration);
      continue;
    }

    // If this initializer is a workflow builder chain, convert it into a new
    // exported runtime function. Otherwise keep it as-is unless it only exists
    // to support stripped `createStep` code.
    const workflowChain = parseWorkflowChain(declaration.init);
    if (!workflowChain && nodeReferencesName(declaration.init, state.strippedNames)) {
      state.strippedNames.add(declaration.id.name);
      continue;
    }

    if (!workflowChain) {
      declarations.push(declaration);
      continue;
    }

    const [workflowConfig] = workflowChain.createWorkflowCall.arguments;
    if (!workflowConfig || !t.isObjectExpression(workflowConfig)) {
      throw new Error(`Unable to determine workflow config for ${declaration.id.name} in ${filePath}`);
    }

    const { expression: workflowId } = getWorkflowIdMetadata(workflowConfig, declaration.id.name, filePath);
    const workflowExport = getTemporalWorkflowExportFromDeclaration(declaration, filePath);
    if (!workflowExport) {
      throw new Error(`Unable to determine workflow export for ${declaration.id.name} in ${filePath}`);
    }

    // The source binding name is irrelevant at runtime. Temporal looks up the
    // workflow by type, so we derive the exported symbol from the static id.
    const { exportName } = workflowExport;

    state.generatedWorkflowNames.add(exportName);
    if (state.committedWorkflowNames.has(declaration.id.name)) {
      state.committedGeneratedWorkflowNames.add(exportName);
    }
    state.workflowExports.push(workflowExport);
    state.statements.push(
      ...createTemporalWorkflowStatements(
        exportName,
        workflowId,
        workflowChain.methods,
        filePath,
        state.committedWorkflowNames.has(declaration.id.name),
        t.isExportNamedDeclaration(statement) || state.inlineExportedWorkflowNames.has(declaration.id.name),
        state.stepBindings,
      ),
    );
  }

  if (declarations.length > 0) {
    const cloned = declarations.map(declaration => t.cloneNode(declaration, true));
    state.statements.push(
      t.isVariableDeclaration(statement)
        ? t.variableDeclaration(statement.kind, cloned)
        : t.exportNamedDeclaration(t.variableDeclaration(declarationStatement.kind, cloned)),
    );
  }
}

function rewriteWorkflowStatement(statement: t.Statement, filePath: string, state: WorkflowTransformState): void {
  if (t.isImportDeclaration(statement)) {
    rewriteWorkflowImportDeclaration(statement, state);
    return;
  }

  if (getCommittedWorkflowName(statement)) {
    return;
  }

  if (t.isExportNamedDeclaration(statement) && statement.declaration == null) {
    rewriteWorkflowNamedExport(statement, state);
    return;
  }

  if (t.isExportDefaultDeclaration(statement) && t.isIdentifier(statement.declaration)) {
    if (state.workflowNames.has(statement.declaration.name)) {
      state.statements.push(statement);
    }
    return;
  }

  if (getVariableDeclarationFromStatement(statement)) {
    rewriteWorkflowVariableDeclaration(statement, filePath, state);
    return;
  }

  state.statements.push(statement);
}

function appendMissingWorkflowCommits(state: WorkflowTransformState): void {
  for (const workflowName of state.generatedWorkflowNames) {
    if (state.committedGeneratedWorkflowNames.has(workflowName)) {
      continue;
    }

    state.statements.push(
      t.expressionStatement(
        t.callExpression(t.memberExpression(t.identifier(workflowName), t.identifier('commit')), []),
      ),
    );
  }
}

async function finalizeWorkflowModule(
  filePath: string,
  state: WorkflowTransformState,
): Promise<BuildTemporalWorkflowModuleResult> {
  const transformedSource = generate(t.file(t.program(pruneUnusedTopLevelBindings(state.statements), [], 'module')), {
    sourceMaps: false,
  }).code;

  return {
    code: await transpileModule(transformedSource, filePath),
    workflows: state.workflowExports,
  };
}

/**
 * Transforms a user-authored workflow module into a Temporal-friendly module:
 * - strips Mastra/Temporal setup that cannot run in the workflow sandbox
 * - rewrites fluent workflow chains into deterministic exported functions
 * - returns registry metadata so the entry module can re-export the right names
 */
export async function buildTemporalWorkflowModule(
  sourceText: string,
  filePath: string,
  _options: BuildTemporalWorkflowOptions = {},
): Promise<BuildTemporalWorkflowModuleResult> {
  const ast = parseWorkflowModuleAst(sourceText, filePath);
  const state = createWorkflowTransformState(ast.program);

  collectWorkflowTransformMetadata(ast.program, state);

  for (const statement of ast.program.body) {
    // We rewrite only the top-level workflow declarations/exports and keep unrelated
    // module code intact unless it becomes dead after step/workflow stripping.
    rewriteWorkflowStatement(statement, filePath, state);
  }

  appendMissingWorkflowCommits(state);
  return finalizeWorkflowModule(filePath, state);
}

/**
 * Reads only the workflow imports that are referenced from the Mastra entry's
 * `workflows` config. Plain imports in the file are not enough on their own.
 */
function getWorkflowImportSpecifiers(sourceText: string, filePath: string): string[] {
  const ast = parse(sourceText, {
    sourceType: 'module',
    plugins: parserPlugins as any,
    sourceFilename: filePath,
  });

  // First find which local bindings the Mastra config actually registers as workflows,
  // then resolve those bindings back to their import sources.
  const workflowBindings = getWorkflowEntryBindings(ast.program);
  const importBindings = getWorkflowImportBindings(ast.program);
  const workflowSpecifiers: string[] = [];

  for (const workflowBinding of workflowBindings) {
    const importedBinding = importBindings.get(workflowBinding);
    if (!importedBinding) {
      throw new Error(`Unable to find an import for workflow '${workflowBinding}' in ${filePath}`);
    }

    workflowSpecifiers.push(importedBinding.source);
  }

  return [...new Set(workflowSpecifiers)];
}

function getWorkflowPathCandidates(specifier: string, importerPath: string): string[] {
  const basePath = path.resolve(path.dirname(importerPath), specifier);

  return [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.jsx`,
    `${basePath}.mts`,
    `${basePath}.mjs`,
    path.join(basePath, 'index.ts'),
    path.join(basePath, 'index.tsx'),
    path.join(basePath, 'index.js'),
    path.join(basePath, 'index.jsx'),
    path.join(basePath, 'index.mts'),
    path.join(basePath, 'index.mjs'),
  ];
}

export function resolveWorkflowPathSync(specifier: string, importerPath: string): string {
  for (const candidate of getWorkflowPathCandidates(specifier, importerPath)) {
    try {
      if (statSync(candidate).isFile()) {
        return candidate;
      }
    } catch {
      // try next candidate
    }
  }

  throw new Error(`Unable to resolve workflow import '${specifier}' from ${importerPath}`);
}

export async function resolveWorkflowPath(specifier: string, importerPath: string): Promise<string> {
  const { stat } = await import('node:fs/promises');

  for (const candidate of getWorkflowPathCandidates(specifier, importerPath)) {
    try {
      const stats = await stat(candidate);
      if (stats.isFile()) {
        return candidate;
      }
    } catch {
      // try next candidate
    }
  }

  throw new Error(`Unable to resolve workflow import '${specifier}' from ${importerPath}`);
}

export function resolveWorkflowEntriesSync(sourceText: string, filePath: string): string[] {
  return getWorkflowImportSpecifiers(sourceText, filePath).map(specifier =>
    resolveWorkflowPathSync(specifier, filePath),
  );
}

export async function resolveWorkflowEntries(sourceText: string, filePath: string): Promise<string[]> {
  return Promise.all(
    getWorkflowImportSpecifiers(sourceText, filePath).map(specifier => resolveWorkflowPath(specifier, filePath)),
  );
}
