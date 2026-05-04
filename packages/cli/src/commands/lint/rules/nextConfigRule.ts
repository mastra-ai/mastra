import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'acorn';
import type {
  ArrayExpression,
  AssignmentExpression,
  Expression,
  Identifier,
  Literal,
  ObjectExpression,
  Program,
  Property,
} from 'acorn';
import { logger } from '../../../utils/logger.js';
import type { LintContext, LintRule } from './types.js';

interface NextConfig {
  serverExternalPackages?: string[];
}

function isIdentifier(node: unknown): node is Identifier {
  return typeof node === 'object' && node !== null && 'type' in node && node.type === 'Identifier';
}

function isLiteral(node: unknown): node is Literal {
  return typeof node === 'object' && node !== null && 'type' in node && node.type === 'Literal';
}

function isObjectExpression(node: unknown): node is ObjectExpression {
  return typeof node === 'object' && node !== null && 'type' in node && node.type === 'ObjectExpression';
}

function isArrayExpression(node: unknown): node is ArrayExpression {
  return typeof node === 'object' && node !== null && 'type' in node && node.type === 'ArrayExpression';
}

function unwrapExpression(expression: Expression): Expression {
  if (expression.type === 'ParenthesizedExpression') {
    return unwrapExpression(expression.expression);
  }

  return expression;
}

function getPropertyName(property: Property): string | null {
  if (property.computed) {
    return null;
  }

  if (isIdentifier(property.key)) {
    return property.key.name;
  }

  if (isLiteral(property.key) && typeof property.key.value === 'string') {
    return property.key.value;
  }

  return null;
}

function readStringArray(expression: Expression): string[] | null {
  const arrayExpression = unwrapExpression(expression);
  if (!isArrayExpression(arrayExpression)) {
    return null;
  }

  const values: string[] = [];
  for (const element of arrayExpression.elements) {
    if (!isLiteral(element) || typeof element.value !== 'string') {
      return null;
    }

    values.push(element.value);
  }

  return values;
}

function readServerExternalPackages(config: ObjectExpression): string[] | undefined {
  for (const property of config.properties) {
    if (property.type !== 'Property' || property.kind !== 'init' || property.method) {
      continue;
    }

    if (getPropertyName(property) !== 'serverExternalPackages') {
      continue;
    }

    return readStringArray(property.value) ?? undefined;
  }

  return undefined;
}

function parseProgram(nextConfigContent: string): Program {
  const options = { ecmaVersion: 'latest' as const, allowHashBang: true };

  try {
    return parse(nextConfigContent, { ...options, sourceType: 'module' }) as Program;
  } catch {
    return parse(nextConfigContent, { ...options, sourceType: 'script' }) as Program;
  }
}

function collectNextConfigVariables(program: Program): Map<string, ObjectExpression> {
  const variables = new Map<string, ObjectExpression>();

  for (const node of program.body) {
    if (node.type !== 'VariableDeclaration') {
      continue;
    }

    for (const declaration of node.declarations) {
      if (!isIdentifier(declaration.id) || !declaration.init) {
        continue;
      }

      const initializer = unwrapExpression(declaration.init);
      if (isObjectExpression(initializer)) {
        variables.set(declaration.id.name, initializer);
      }
    }
  }

  return variables;
}

function resolveObjectExpression(
  expression: Expression,
  variables: Map<string, ObjectExpression>,
): ObjectExpression | null {
  const unwrappedExpression = unwrapExpression(expression);

  if (isObjectExpression(unwrappedExpression)) {
    return unwrappedExpression;
  }

  if (isIdentifier(unwrappedExpression)) {
    return variables.get(unwrappedExpression.name) ?? null;
  }

  return null;
}

function isModuleExportsAssignment(expression: Expression): expression is AssignmentExpression {
  if (expression.type !== 'AssignmentExpression' || expression.operator !== '=') {
    return false;
  }

  const { left } = expression;
  return (
    left.type === 'MemberExpression' &&
    !left.computed &&
    isIdentifier(left.object) &&
    left.object.name === 'module' &&
    isIdentifier(left.property) &&
    left.property.name === 'exports'
  );
}

function findNextConfigObject(program: Program): ObjectExpression | null {
  const nextConfigVariables = collectNextConfigVariables(program);
  const namedNextConfig = nextConfigVariables.get('nextConfig');
  if (namedNextConfig) {
    return namedNextConfig;
  }

  for (const node of program.body) {
    if (node.type === 'ExpressionStatement' && isModuleExportsAssignment(node.expression)) {
      const moduleExportsConfig = resolveObjectExpression(node.expression.right, nextConfigVariables);
      if (moduleExportsConfig) {
        return moduleExportsConfig;
      }
    }

    if (
      node.type === 'ExportDefaultDeclaration' &&
      node.declaration.type !== 'FunctionDeclaration' &&
      node.declaration.type !== 'ClassDeclaration'
    ) {
      const exportedConfig = resolveObjectExpression(node.declaration, nextConfigVariables);
      if (exportedConfig) {
        return exportedConfig;
      }
    }
  }

  return null;
}

function parseNextConfig(nextConfigContent: string): NextConfig | null {
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
