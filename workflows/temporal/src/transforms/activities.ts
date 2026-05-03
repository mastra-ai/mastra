import path, { basename, join } from 'node:path';
import { generate } from '@babel/generator';
import { parse } from '@babel/parser';
import * as t from '@babel/types';
import { rollup } from 'rollup';
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
  walk,
} from './shared';

export interface TemporalActivityBinding {
  exportName: string;
  stepId: string;
}

export interface BuildTemporalActivitiesModuleResult {
  outputPath: string;
  activityBindings: TemporalActivityBinding[];
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

function normalizeImportPath(importPath: string, extension: string): string {
  const normalizedPath = importPath.split(path.sep).join('/');
  const pathWithExtension =
    extension === '.mjs' || extension === '.cjs' ? normalizedPath : normalizedPath.replace(/\.[cm]?[jt]sx?$/, '');

  return pathWithExtension.startsWith('.') ? pathWithExtension : `./${pathWithExtension}`;
}

function rebaseModulePath(modulePath: string, sourceFilePath: string, outputFilePath: string): string {
  if (!modulePath.startsWith('.')) {
    return modulePath;
  }

  const resolvedPath = path.resolve(path.dirname(sourceFilePath), modulePath);
  const relativePath = path.relative(path.dirname(outputFilePath), resolvedPath);
  return normalizeImportPath(relativePath, path.extname(resolvedPath));
}

function collectWorkflowBindingNames(ast: t.File): Set<string> {
  const workflowNames = new Set<string>();

  for (const statement of ast.program.body) {
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
      if (t.isIdentifier(declaration.id) && declaration.init && hasCreateWorkflowCall(declaration.init)) {
        workflowNames.add(declaration.id.name);
      }
    }
  }

  return workflowNames;
}

function isMastraDeclaration(declaration: t.VariableDeclarator): boolean {
  return t.isIdentifier(declaration.id) && declaration.id.name === 'mastra';
}

function removeStrippedReferencesFromMastraInitializer(init: t.Expression, strippedNames: Set<string>): t.Expression {
  const clonedInit = t.cloneNode(init, true);

  if (!t.isNewExpression(clonedInit) && !t.isCallExpression(clonedInit)) {
    return clonedInit;
  }

  const config = clonedInit.arguments[0];
  if (!t.isObjectExpression(config)) {
    return clonedInit;
  }

  config.properties = config.properties.filter(property => !nodeReferencesName(property, strippedNames));
  return clonedInit;
}

function createPreservedDeclaration(
  declaration: t.VariableDeclarator,
  strippedNames: Set<string>,
): t.VariableDeclarator {
  if (!isMastraDeclaration(declaration) || !declaration.init) {
    return t.cloneNode(declaration, true);
  }

  return t.variableDeclarator(
    t.cloneNode(declaration.id, true),
    removeStrippedReferencesFromMastraInitializer(declaration.init, strippedNames),
  );
}

function hasLocalMastraBinding(ast: t.File): boolean {
  return ast.program.body.some(statement => {
    const declaration = t.isExportNamedDeclaration(statement) ? statement.declaration : statement;
    if (!t.isVariableDeclaration(declaration)) {
      return false;
    }

    return declaration.declarations.some(declarator => t.isIdentifier(declarator.id, { name: 'mastra' }));
  });
}

function createTemporalActivitiesHelperStatements(
  mastraImportPath: string | null,
  hasMastraBinding: boolean,
): t.Statement[] {
  const helperSource = mastraImportPath
    ? `
        function createStep(args) {
          return async (params) => {
            const { mastra } = await import(${JSON.stringify(mastraImportPath)});
            return args.execute({ ...params, mastra });
          };
        }
      `
    : hasMastraBinding
      ? `
        function createStep(args) {
          return async (params) => {
            return args.execute({ ...params, mastra });
          };
        }
      `
      : `
        function createStep(args) {
          return async (params) => {
            return args.execute(params);
          };
        }
      `;

  return parse(helperSource, {
    sourceType: 'module',
    plugins: parserPlugins as any,
  }).program.body;
}

export async function buildTemporalActivitiesModule(
  entryFile: string,
  outputDirectory: string,
  outputFileName: string,
): Promise<BuildTemporalActivitiesModuleResult> {
  const activityBindings: TemporalActivityBinding[] = [];
  const seenActivityBindingNames = new Set<string>();
  const addActivityBinding = (exportName: string, call: t.CallExpression): void => {
    const stepId = getCreateStepId(call);

    if (!stepId || seenActivityBindingNames.has(exportName)) {
      return;
    }

    seenActivityBindingNames.add(exportName);
    activityBindings.push({ exportName, stepId });
  };

  const bundle = await rollup({
    input: entryFile,
    treeshake: 'smallest',
    logLevel: 'silent',
    plugins: [
      {
        name: 'temporal-workflow-transform',
        transform(code, id) {
          const ast = parse(code, {
            sourceType: 'module',
            plugins: parserPlugins as any,
            sourceFilename: id,
          });

          const statements: t.Statement[] = [];
          const seenNames = new Set<string>();
          const strippedNames = new Set<string>();
          const workflowBindingNames = collectWorkflowBindingNames(ast);
          const sourceFilePath = id;
          const hasMastraBinding = hasLocalMastraBinding(ast);
          let helperInserted = false;

          const ensureHelperInserted = () => {
            if (helperInserted) {
              return;
            }

            statements.push(...createTemporalActivitiesHelperStatements(null, hasMastraBinding));
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

              const rewrittenSource = rebaseModulePath(statement.source.value, sourceFilePath, id);
              if (rewrittenSource === statement.source.value) {
                statements.push(statement);
              } else {
                statements.push(
                  t.importDeclaration(
                    statement.specifiers.map(specifier => t.cloneNode(specifier, true)),
                    t.stringLiteral(rewrittenSource),
                  ),
                );
              }
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

                if (
                  declaration.init &&
                  nodeReferencesName(declaration.init, strippedNames) &&
                  !isMastraDeclaration(declaration)
                ) {
                  if (t.isIdentifier(declaration.id)) {
                    strippedNames.add(declaration.id.name);
                  }
                  continue;
                }

                if (!t.isIdentifier(declaration.id) || !declaration.init) {
                  declarations.push(createPreservedDeclaration(declaration, strippedNames));
                  continue;
                }

                if (isCreateStepCall(declaration.init)) {
                  seenNames.add(declaration.id.name);
                  addActivityBinding(declaration.id.name, declaration.init);
                  statements.push(createExportedStepStatement(declaration.id.name, declaration.init));
                  continue;
                }

                if (hasCreateWorkflowCall(declaration.init)) {
                  workflowBindingNames.add(declaration.id.name);
                  strippedNames.add(declaration.id.name);
                  collectInlineCreateSteps(declaration.init, seenNames, statements, addActivityBinding);
                  continue;
                }

                declarations.push(createPreservedDeclaration(declaration, strippedNames));
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
              const exportedDeclarations: t.VariableDeclarator[] = [];
              const localDeclarations: t.VariableDeclarator[] = [];

              for (const declaration of statement.declaration.declarations) {
                if (isWorkflowHelperDestructure(declaration)) {
                  continue;
                }

                if (
                  declaration.init &&
                  nodeReferencesName(declaration.init, strippedNames) &&
                  !isMastraDeclaration(declaration)
                ) {
                  if (t.isIdentifier(declaration.id)) {
                    strippedNames.add(declaration.id.name);
                  }
                  continue;
                }

                if (!t.isIdentifier(declaration.id) || !declaration.init) {
                  exportedDeclarations.push(createPreservedDeclaration(declaration, strippedNames));
                  continue;
                }

                if (isCreateStepCall(declaration.init)) {
                  seenNames.add(declaration.id.name);
                  addActivityBinding(declaration.id.name, declaration.init);
                  statements.push(createExportedStepStatement(declaration.id.name, declaration.init));
                  continue;
                }

                if (hasCreateWorkflowCall(declaration.init)) {
                  workflowBindingNames.add(declaration.id.name);
                  strippedNames.add(declaration.id.name);
                  collectInlineCreateSteps(declaration.init, seenNames, statements, addActivityBinding);
                  continue;
                }

                if (declaration.id.name === 'mastra') {
                  localDeclarations.push(createPreservedDeclaration(declaration, strippedNames));
                  continue;
                }

                exportedDeclarations.push(createPreservedDeclaration(declaration, strippedNames));
              }

              if (localDeclarations.length > 0) {
                statements.push(
                  t.variableDeclaration(
                    statement.declaration.kind,
                    localDeclarations.map(declaration => t.cloneNode(declaration, true)),
                  ),
                );
              }

              if (exportedDeclarations.length > 0) {
                statements.push(
                  t.exportNamedDeclaration(
                    t.variableDeclaration(
                      statement.declaration.kind,
                      exportedDeclarations.map(declaration => t.cloneNode(declaration, true)),
                    ),
                  ),
                );
              }
              continue;
            }

            if (t.isExpressionStatement(statement)) {
              if (nodeReferencesName(statement, workflowBindingNames) || nodeReferencesName(statement, strippedNames)) {
                collectInlineCreateSteps(statement, seenNames, statements, addActivityBinding);
                continue;
              }

              collectInlineCreateSteps(statement, seenNames, statements, addActivityBinding);
              continue;
            }

            if (t.isExportNamedDeclaration(statement)) {
              if (statement.declaration == null && statement.source == null) {
                const retainedSpecifiers = statement.specifiers.filter(
                  specifier =>
                    t.isExportSpecifier(specifier) &&
                    t.isIdentifier(specifier.local) &&
                    specifier.local.name !== 'mastra' &&
                    !workflowBindingNames.has(specifier.local.name) &&
                    !seenNames.has(specifier.local.name),
                );

                if (retainedSpecifiers.length > 0) {
                  statements.push(t.exportNamedDeclaration(null, retainedSpecifiers));
                }
                continue;
              }

              if (statement.declaration == null && statement.source) {
                const mastraSpecifiers = statement.specifiers.filter(
                  specifier =>
                    t.isExportSpecifier(specifier) &&
                    t.isIdentifier(specifier.exported, { name: 'mastra' }) &&
                    t.isIdentifier(specifier.local, { name: 'mastra' }),
                );

                if (mastraSpecifiers.length > 0) {
                  statements.push(
                    t.importDeclaration(
                      [t.importSpecifier(t.identifier('mastra'), t.identifier('mastra'))],
                      t.stringLiteral(rebaseModulePath(statement.source.value, sourceFilePath, id)),
                    ),
                  );
                }
                continue;
              }

              collectInlineCreateSteps(statement, seenNames, statements, addActivityBinding);
              continue;
            }

            if (t.isExportDefaultDeclaration(statement)) {
              if (t.isIdentifier(statement.declaration) && workflowBindingNames.has(statement.declaration.name)) {
                continue;
              }

              collectInlineCreateSteps(statement, seenNames, statements, addActivityBinding);
              continue;
            }

            statements.push(statement);
          }

          ensureHelperInserted();

          const transformedSource = generate(t.file(t.program(pruneUnusedTopLevelBindings(statements), [], 'module')), {
            sourceMaps: true,
          });

          return transformedSource;
        },
      },
    ],
  });

  try {
    const baseName = basename(outputFileName);
    const { output } = await bundle.write({
      dir: outputDirectory,
      entryFileNames: outputFileName,
      chunkFileNames: `${baseName}-[hash].mjs`,
      format: 'esm',
      sourcemap: 'inline',
    });

    return {
      outputPath: join(outputDirectory, output.find(chunk => chunk.type === 'chunk' && chunk.isEntry)!.fileName),
      activityBindings,
    };
  } finally {
    await bundle.close();
  }
}
