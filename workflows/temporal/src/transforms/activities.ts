import path from 'node:path';
import { generate } from '@babel/generator';
import { parse } from '@babel/parser';
import * as t from '@babel/types';
import {
  collectImportedNames,
  collectInlineCreateSteps,
  createExportedStepStatement,
  getCreateStepId,
  getStepNameFromCall,
  hasCreateWorkflowCall,
  isCreateStepCall,
  isStrippedExternalModule,
  isTemporalHelperModule,
  isWorkflowHelperDestructure,
  nodeReferencesName,
  parserPlugins,
  pruneUnusedTopLevelBindings,
  transpileModule,
  walk,
} from './shared';

export interface TemporalActivityBinding {
  exportName: string;
  stepId: string;
}

export interface BuildTemporalActivitiesOptions {
  entryFilePath?: string;
  mastraImportPath?: string;
}

export function collectTemporalActivityBindings(sourceText: string, filePath: string): TemporalActivityBinding[] {
  const ast = parse(sourceText, {
    sourceType: 'module',
    plugins: parserPlugins as any,
    sourceFilename: filePath,
  });

  const bindings: TemporalActivityBinding[] = [];
  const seenNames = new Set<string>();

  const addBinding = (call: t.CallExpression): void => {
    const exportName = getStepNameFromCall(call);
    const stepId = getCreateStepId(call);

    if (!exportName || !stepId || seenNames.has(exportName)) {
      return;
    }

    seenNames.add(exportName);
    bindings.push({ exportName, stepId });
  };

  const collectInlineBindings = (node: t.Node): void => {
    walk(node, current => {
      if (!isCreateStepCall(current)) {
        return;
      }

      addBinding(current);
      return false;
    });
  };

  for (const statement of ast.program.body) {
    if (
      t.isVariableDeclaration(statement) ||
      (t.isExportNamedDeclaration(statement) && t.isVariableDeclaration(statement.declaration))
    ) {
      const declarationStatement = t.isVariableDeclaration(statement)
        ? statement
        : (statement.declaration as t.VariableDeclaration);

      for (const declaration of declarationStatement.declarations) {
        if (!declaration.init) {
          continue;
        }

        if (isCreateStepCall(declaration.init)) {
          addBinding(declaration.init);
          continue;
        }

        if (hasCreateWorkflowCall(declaration.init)) {
          collectInlineBindings(declaration.init);
        }
      }

      continue;
    }

    if (hasCreateWorkflowCall(statement)) {
      collectInlineBindings(statement);
    }
  }

  return bindings;
}

function getMastraImportPath(filePath: string, options: BuildTemporalActivitiesOptions): string {
  if (options.entryFilePath) {
    const relativePath = path.relative(path.dirname(filePath), options.entryFilePath);
    const normalizedPath = relativePath
      .replace(/\.[cm]?[jt]sx?$/, '')
      .split(path.sep)
      .join('/');
    return normalizedPath.startsWith('.') ? normalizedPath : `./${normalizedPath}`;
  }

  return options.mastraImportPath ?? './index';
}

function createTemporalActivitiesHelperStatements(mastraImportPath: string): t.Statement[] {
  const helperSource = `
    function createStep(args) {
      return async (params) => {
        const { mastra } = await import(${JSON.stringify(mastraImportPath)});
        return args.execute({ ...params, mastra });
      };
    }
  `;

  return parse(helperSource, {
    sourceType: 'module',
    plugins: parserPlugins as any,
  }).program.body;
}

export async function buildTemporalActivitiesModule(
  sourceText: string,
  filePath: string,
  options: BuildTemporalActivitiesOptions = {},
): Promise<string> {
  const ast = parse(sourceText, {
    sourceType: 'module',
    plugins: parserPlugins as any,
    sourceFilename: filePath,
  });

  const statements: t.Statement[] = [];
  const seenNames = new Set<string>();
  const strippedNames = new Set<string>();
  let helperInserted = false;

  const ensureHelperInserted = () => {
    if (helperInserted) {
      return;
    }

    statements.push(...createTemporalActivitiesHelperStatements(getMastraImportPath(filePath, options)));
    helperInserted = true;
  };

  for (const statement of ast.program.body) {
    if (t.isImportDeclaration(statement)) {
      if (statement.source.value === '@mastra/core/workflows') {
        const retainedSpecifiers = statement.specifiers.filter(
          specifier =>
            !(
              t.isImportSpecifier(specifier) &&
              t.isIdentifier(specifier.imported) &&
              (specifier.imported.name === 'createStep' || specifier.imported.name === 'createWorkflow')
            ),
        );

        if (retainedSpecifiers.length > 0) {
          statements.push(t.importDeclaration(retainedSpecifiers, t.stringLiteral(statement.source.value)));
        }
        continue;
      }

      if (isTemporalHelperModule(statement.source.value) || isStrippedExternalModule(statement.source.value)) {
        for (const name of collectImportedNames(statement)) {
          strippedNames.add(name);
        }
        continue;
      }

      statements.push(statement);
      continue;
    }

    if (
      t.isFunctionDeclaration(statement) ||
      t.isClassDeclaration(statement) ||
      t.isTSTypeAliasDeclaration(statement) ||
      t.isTSInterfaceDeclaration(statement) ||
      t.isTSEnumDeclaration(statement)
    ) {
      ensureHelperInserted();
      statements.push(statement);
      continue;
    }

    if (t.isExpressionStatement(statement) && nodeReferencesName(statement, strippedNames)) {
      continue;
    }

    ensureHelperInserted();

    if (t.isVariableDeclaration(statement)) {
      const declarations: t.VariableDeclarator[] = [];

      for (const declaration of statement.declarations) {
        if (isWorkflowHelperDestructure(declaration)) {
          continue;
        }

        if (declaration.init && nodeReferencesName(declaration.init, strippedNames)) {
          if (t.isIdentifier(declaration.id)) {
            strippedNames.add(declaration.id.name);
          }
          continue;
        }

        if (!t.isIdentifier(declaration.id) || !declaration.init) {
          declarations.push(declaration);
          continue;
        }

        if (isCreateStepCall(declaration.init)) {
          seenNames.add(declaration.id.name);
          statements.push(createExportedStepStatement(declaration.id.name, declaration.init));
          continue;
        }

        if (hasCreateWorkflowCall(declaration.init)) {
          collectInlineCreateSteps(declaration.init, seenNames, statements);
          continue;
        }

        declarations.push(declaration);
      }

      if (declarations.length > 0) {
        statements.push(
          t.variableDeclaration(
            statement.kind,
            declarations.map(declaration => t.cloneNode(declaration, true)),
          ),
        );
      }
      continue;
    }

    if (t.isExportNamedDeclaration(statement) && t.isVariableDeclaration(statement.declaration)) {
      const declarations: t.VariableDeclarator[] = [];

      for (const declaration of statement.declaration.declarations) {
        if (isWorkflowHelperDestructure(declaration)) {
          continue;
        }

        if (declaration.init && nodeReferencesName(declaration.init, strippedNames)) {
          if (t.isIdentifier(declaration.id)) {
            strippedNames.add(declaration.id.name);
          }
          continue;
        }

        if (!t.isIdentifier(declaration.id) || !declaration.init) {
          declarations.push(declaration);
          continue;
        }

        if (isCreateStepCall(declaration.init)) {
          seenNames.add(declaration.id.name);
          statements.push(createExportedStepStatement(declaration.id.name, declaration.init));
          continue;
        }

        if (hasCreateWorkflowCall(declaration.init)) {
          collectInlineCreateSteps(declaration.init, seenNames, statements);
          continue;
        }

        declarations.push(declaration);
      }

      if (declarations.length > 0) {
        statements.push(
          t.exportNamedDeclaration(
            t.variableDeclaration(
              statement.declaration.kind,
              declarations.map(declaration => t.cloneNode(declaration, true)),
            ),
          ),
        );
      }
      continue;
    }

    if (
      t.isExpressionStatement(statement) ||
      t.isExportNamedDeclaration(statement) ||
      t.isExportDefaultDeclaration(statement)
    ) {
      collectInlineCreateSteps(statement, seenNames, statements);
      continue;
    }

    statements.push(statement);
  }

  ensureHelperInserted();

  const transformedSource = generate(t.file(t.program(pruneUnusedTopLevelBindings(statements), [], 'module')), {
    sourceMaps: false,
  }).code;

  return transpileModule(transformedSource, filePath);
}
