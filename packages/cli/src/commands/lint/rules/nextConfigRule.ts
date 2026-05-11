import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from '@babel/parser';
import * as t from '@babel/types';
import { logger } from '../../../utils/logger.js';
import type { LintContext, LintRule } from './types.js';

interface NextConfig {
  serverExternalPackages?: string[];
}

function unwrapExpression(expression: t.Expression): t.Expression {
  if (t.isParenthesizedExpression(expression)) {
    return unwrapExpression(expression.expression);
  }

  return expression;
}

function getPropertyName(property: t.ObjectProperty): string | null {
  if (property.computed) {
    return null;
  }

  if (t.isIdentifier(property.key)) {
    return property.key.name;
  }

  if (t.isStringLiteral(property.key)) {
    return property.key.value;
  }

  return null;
}

function readStringArray(expression: t.Expression): string[] | null {
  const arrayExpression = unwrapExpression(expression);
  if (!t.isArrayExpression(arrayExpression)) {
    return null;
  }

  const values: string[] = [];
  for (const element of arrayExpression.elements) {
    if (!t.isStringLiteral(element)) {
      return null;
    }

    values.push(element.value);
  }

  return values;
}

function readServerExternalPackages(config: t.ObjectExpression): string[] | undefined {
  for (const property of config.properties) {
    if (!t.isObjectProperty(property) || !t.isExpression(property.value)) {
      continue;
    }

    if (getPropertyName(property) !== 'serverExternalPackages') {
      continue;
    }

    return readStringArray(property.value) ?? undefined;
  }

  return undefined;
}

function parseProgram(nextConfigContent: string): t.Program {
  return parse(nextConfigContent, {
    sourceType: 'unambiguous',
    plugins: ['typescript', 'jsx', 'importAttributes'],
  }).program;
}

function collectNextConfigVariables(program: t.Program): Map<string, t.ObjectExpression> {
  const variables = new Map<string, t.ObjectExpression>();

  for (const node of program.body) {
    if (!t.isVariableDeclaration(node)) {
      continue;
    }

    for (const declaration of node.declarations) {
      if (!t.isIdentifier(declaration.id) || !declaration.init) {
        continue;
      }

      const initializer = unwrapExpression(declaration.init);
      if (t.isObjectExpression(initializer)) {
        variables.set(declaration.id.name, initializer);
      }
    }
  }

  return variables;
}

function resolveObjectExpression(
  expression: t.Expression,
  variables: Map<string, t.ObjectExpression>,
): t.ObjectExpression | null {
  const unwrappedExpression = unwrapExpression(expression);

  if (t.isObjectExpression(unwrappedExpression)) {
    return unwrappedExpression;
  }

  if (t.isIdentifier(unwrappedExpression)) {
    return variables.get(unwrappedExpression.name) ?? null;
  }

  return null;
}

function isModuleExportsAssignment(expression: t.Expression): expression is t.AssignmentExpression {
  if (!t.isAssignmentExpression(expression) || expression.operator !== '=') {
    return false;
  }

  const { left } = expression;
  return (
    t.isMemberExpression(left) &&
    !left.computed &&
    t.isIdentifier(left.object) &&
    left.object.name === 'module' &&
    t.isIdentifier(left.property) &&
    left.property.name === 'exports'
  );
}

function findNextConfigObject(program: t.Program): t.ObjectExpression | null {
  const nextConfigVariables = collectNextConfigVariables(program);
  const namedNextConfig = nextConfigVariables.get('nextConfig');
  if (namedNextConfig) {
    return namedNextConfig;
  }

  for (const node of program.body) {
    if (t.isExpressionStatement(node) && isModuleExportsAssignment(node.expression)) {
      const moduleExportsConfig = resolveObjectExpression(node.expression.right, nextConfigVariables);
      if (moduleExportsConfig) {
        return moduleExportsConfig;
      }
    }

    if (t.isExportDefaultDeclaration(node) && t.isExpression(node.declaration)) {
      const exportedConfig = resolveObjectExpression(node.declaration, nextConfigVariables);
      if (exportedConfig) {
        return exportedConfig;
      }
    }
  }

  return null;
}

function parseNextConfig(nextConfigContent: string): NextConfig | null {
  if (!nextConfigContent.includes('serverExternalPackages')) {
    return {};
  }

  const program = parseProgram(nextConfigContent);
  const config = findNextConfigObject(program);
  if (!config) {
    return null;
  }

  return {
    serverExternalPackages: readServerExternalPackages(config),
  };
}

function readNextConfig(dir: string) {
  const nextConfigPath = join(dir, 'next.config.js');
  try {
    const nextConfigContent = readFileSync(nextConfigPath, 'utf-8');
    return parseNextConfig(nextConfigContent);
  } catch {
    return null;
  }
}

function isNextJsProject(dir: string): boolean {
  const nextConfigPath = join(dir, 'next.config.js');
  try {
    readFileSync(nextConfigPath, 'utf-8');
    return true;
  } catch {
    return false;
  }
}

export const nextConfigRule: LintRule = {
  name: 'next-config',
  description: 'Checks if Next.js config is properly configured for Mastra packages',
  async run(context: LintContext): Promise<boolean> {
    if (!isNextJsProject(context.rootDir)) {
      return true;
    }

    const nextConfig = readNextConfig(context.rootDir);
    if (!nextConfig) {
      return false;
    }

    const serverExternals = nextConfig.serverExternalPackages || [];
    const hasMastraExternals = serverExternals.some(
      (pkg: string) => pkg === '@mastra/*' || pkg === '@mastra/core' || pkg.startsWith('@mastra/'),
    );

    if (!hasMastraExternals) {
      logger.error('next.config.js is missing Mastra packages in serverExternalPackages');
      logger.error('Please add the following to your next.config.js:');
      logger.error('  serverExternalPackages: ["@mastra/*"],');
      return false;
    }

    logger.info('Next.js config is properly configured for Mastra packages');
    return true;
  },
};
