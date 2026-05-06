import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { logger } from '../../../utils/logger.js';
import type { LintContext, LintRule } from './types.js';

interface NextConfig {
  serverExternalPackages?: string[];
}

function getPropertyNameText(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }

  return null;
}

function readStaticStringArray(expression: ts.Expression): string[] | null {
  if (!ts.isArrayLiteralExpression(expression)) {
    return null;
  }

  const values: string[] = [];
  for (const element of expression.elements) {
    if (!ts.isStringLiteral(element) && !ts.isNoSubstitutionTemplateLiteral(element)) {
      return null;
    }

    values.push(element.text);
  }

  return values;
}

function readConfigObject(configObject: ts.ObjectLiteralExpression): NextConfig {
  const config: NextConfig = {};

  for (const property of configObject.properties) {
    if (!ts.isPropertyAssignment(property) || getPropertyNameText(property.name) !== 'serverExternalPackages') {
      continue;
    }

    const serverExternalPackages = readStaticStringArray(property.initializer);
    if (serverExternalPackages) {
      config.serverExternalPackages = serverExternalPackages;
    } else {
      delete config.serverExternalPackages;
    }
  }

  return config;
}

function isModuleExports(expression: ts.Expression): boolean {
  return (
    ts.isPropertyAccessExpression(expression) &&
    expression.name.text === 'exports' &&
    ts.isIdentifier(expression.expression) &&
    expression.expression.text === 'module'
  );
}

function findNextConfigObject(sourceFile: ts.SourceFile): ts.ObjectLiteralExpression | null {
  let configObject: ts.ObjectLiteralExpression | null = null;

  sourceFile.forEachChild(node => {
    if (configObject) {
      return;
    }

    if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === 'nextConfig' &&
          declaration.initializer &&
          ts.isObjectLiteralExpression(declaration.initializer)
        ) {
          configObject = declaration.initializer;
          return;
        }
      }
    }

    if (
      ts.isExpressionStatement(node) &&
      ts.isBinaryExpression(node.expression) &&
      node.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      isModuleExports(node.expression.left) &&
      ts.isObjectLiteralExpression(node.expression.right)
    ) {
      configObject = node.expression.right;
      return;
    }

    if (ts.isExportAssignment(node) && ts.isObjectLiteralExpression(node.expression)) {
      configObject = node.expression;
    }
  });

  return configObject;
}

function readNextConfig(dir: string): NextConfig | null {
  const nextConfigPath = join(dir, 'next.config.js');
  try {
    const nextConfigContent = readFileSync(nextConfigPath, 'utf-8');
    const sourceFile = ts.createSourceFile(
      nextConfigPath,
      nextConfigContent,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS,
    );
    const configObject = findNextConfigObject(sourceFile);
    if (!configObject) {
      return null;
    }

    return readConfigObject(configObject);
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
// TODO: Move to babel
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
