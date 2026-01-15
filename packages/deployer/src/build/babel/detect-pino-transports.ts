import type { PluginObj, NodePath } from '@babel/core';
import babel, { types as t } from '@babel/core';
import traverse from '@babel/traverse';

/**
 * Babel plugin to detect pino transport targets in code.
 * Matches patterns like:
 * - pino.transport({ target: "package-name" })
 * - pino.transport({ targets: [{ target: "package-name" }] })
 * - variable.transport({ target: "..." }) where variable is assigned from pino import
 *
 * This replaces the regex-based detection with proper AST analysis.
 *
 * @param transports - Set to collect detected transport package names
 * @returns Babel plugin object
 */
export function detectPinoTransportsPlugin(transports: Set<string>): PluginObj {
  /**
   * Extract string value from a node (supports StringLiteral and TemplateLiteral without expressions)
   */
  function getStringValue(node: t.Node | null | undefined): string | null {
    if (!node) return null;

    if (t.isStringLiteral(node)) {
      return node.value;
    }

    // Handle template literals without expressions: `my-transport`
    if (t.isTemplateLiteral(node) && node.expressions.length === 0 && node.quasis.length === 1) {
      return node.quasis[0]?.value.cooked ?? null;
    }

    return null;
  }

  /**
   * Check if a binding came from a pino import/require
   */
  function isBindingFromPino(path: NodePath<t.CallExpression>, identifierName: string): boolean {
    const binding = path.scope.getBinding(identifierName);
    if (!binding) {
      // No binding found - could be global `pino` (unlikely but accept literal name)
      return identifierName === 'pino';
    }

    const bindingPath = binding.path;

    // Check import declarations
    if (bindingPath.isImportDefaultSpecifier() || bindingPath.isImportNamespaceSpecifier()) {
      const importDecl = bindingPath.parentPath;
      if (importDecl?.isImportDeclaration()) {
        return importDecl.node.source.value === 'pino';
      }
    }

    if (bindingPath.isImportSpecifier()) {
      const importDecl = bindingPath.parentPath;
      if (importDecl?.isImportDeclaration() && importDecl.node.source.value === 'pino') {
        // Only accept if importing 'default'
        const imported = bindingPath.node.imported;
        if (t.isIdentifier(imported) && imported.name === 'default') {
          return true;
        }
        if (t.isStringLiteral(imported) && imported.value === 'default') {
          return true;
        }
      }
      return false;
    }

    // Check require() in variable declarator
    if (bindingPath.isVariableDeclarator()) {
      const init = bindingPath.node.init;
      if (
        t.isCallExpression(init) &&
        t.isIdentifier(init.callee, { name: 'require' }) &&
        init.arguments.length === 1 &&
        t.isStringLiteral(init.arguments[0]) &&
        init.arguments[0].value === 'pino'
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a call expression is a pino.transport() call using scope analysis
   */
  function isPinoTransportCall(path: NodePath<t.CallExpression>): boolean {
    const callee = path.node.callee;

    // Must be member expression like `something.transport`
    if (!t.isMemberExpression(callee)) return false;
    if (!t.isIdentifier(callee.property, { name: 'transport' })) return false;

    // Handle `pino.transport()` or `logger.transport()` where logger is bound to pino
    if (t.isIdentifier(callee.object)) {
      return isBindingFromPino(path, callee.object.name);
    }

    // Handle `pino.default.transport()` pattern (namespace import interop)
    if (
      t.isMemberExpression(callee.object) &&
      t.isIdentifier(callee.object.object) &&
      t.isIdentifier(callee.object.property, { name: 'default' })
    ) {
      return isBindingFromPino(path, callee.object.object.name);
    }

    return false;
  }

  /**
   * Extract target value from an object property
   */
  function extractTargetFromProperty(prop: t.ObjectProperty | t.ObjectMethod | t.SpreadElement): string | null {
    if (!t.isObjectProperty(prop)) return null;

    const key = prop.key;
    if (t.isIdentifier(key, { name: 'target' }) || (t.isStringLiteral(key) && key.value === 'target')) {
      return getStringValue(prop.value);
    }

    return null;
  }

  /**
   * Process the argument to pino.transport() to extract targets
   */
  function processTransportArgument(arg: t.Node): void {
    if (!t.isObjectExpression(arg)) return;

    for (const prop of arg.properties) {
      if (!t.isObjectProperty(prop)) continue;

      const key = prop.key;
      const keyName = t.isIdentifier(key) ? key.name : t.isStringLiteral(key) ? key.value : null;

      if (keyName === 'target') {
        // Single target: { target: "package-name" }
        const value = getStringValue(prop.value);
        if (value) {
          transports.add(value);
        }
      } else if (keyName === 'targets') {
        // Multiple targets: { targets: [{ target: "pkg1" }, { target: "pkg2" }] }
        if (t.isArrayExpression(prop.value)) {
          for (const element of prop.value.elements) {
            if (t.isObjectExpression(element)) {
              for (const innerProp of element.properties) {
                const targetValue = extractTargetFromProperty(innerProp);
                if (targetValue) {
                  transports.add(targetValue);
                }
              }
            }
          }
        }
      }
    }
  }

  return {
    visitor: {
      // Find pino.transport() calls with scope-aware detection
      CallExpression(path) {
        if (!isPinoTransportCall(path)) return;

        // Process first argument which should be the transport config object
        const firstArg = path.node.arguments[0];
        if (firstArg && !t.isSpreadElement(firstArg)) {
          processTransportArgument(firstArg);
        }
      },
    },
  };
}

/**
 * Detects pino transport targets in code using Babel AST parsing.
 * This is the main entry point that replaces the regex-based detection.
 *
 * Uses parseSync + traverse instead of transformSync for efficiency.
 *
 * @param code - The source code to analyze
 * @returns Set of detected transport package names
 */
export function detectPinoTransports(code: string): Set<string> {
  const transports = new Set<string>();

  try {
    // Parse with support for TypeScript and JSX
    const ast = babel.parseSync(code, {
      filename: 'pino-transport-detection.tsx',
      presets: [require.resolve('@babel/preset-typescript')],
      plugins: [
        // Enable JSX parsing
        [require.resolve('@babel/plugin-syntax-jsx')],
      ],
      configFile: false,
      babelrc: false,
    });

    if (!ast) return transports;

    // Helper functions inline for traverse
    function getStringValue(node: t.Node | null | undefined): string | null {
      if (!node) return null;
      if (t.isStringLiteral(node)) return node.value;
      if (t.isTemplateLiteral(node) && node.expressions.length === 0 && node.quasis.length === 1) {
        return node.quasis[0]?.value.cooked ?? null;
      }
      return null;
    }

    function extractTargetFromProperty(prop: t.ObjectProperty | t.ObjectMethod | t.SpreadElement): string | null {
      if (!t.isObjectProperty(prop)) return null;
      const key = prop.key;
      if (t.isIdentifier(key, { name: 'target' }) || (t.isStringLiteral(key) && key.value === 'target')) {
        return getStringValue(prop.value);
      }
      return null;
    }

    function processTransportArgument(arg: t.Node): void {
      if (!t.isObjectExpression(arg)) return;

      for (const prop of arg.properties) {
        if (!t.isObjectProperty(prop)) continue;

        const key = prop.key;
        const keyName = t.isIdentifier(key) ? key.name : t.isStringLiteral(key) ? key.value : null;

        if (keyName === 'target') {
          const value = getStringValue(prop.value);
          if (value) transports.add(value);
        } else if (keyName === 'targets') {
          if (t.isArrayExpression(prop.value)) {
            for (const element of prop.value.elements) {
              if (t.isObjectExpression(element)) {
                for (const innerProp of element.properties) {
                  const targetValue = extractTargetFromProperty(innerProp);
                  if (targetValue) transports.add(targetValue);
                }
              }
            }
          }
        }
      }
    }

    function isBindingFromPino(path: NodePath<t.CallExpression>, identifierName: string): boolean {
      const binding = path.scope.getBinding(identifierName);
      if (!binding) {
        // No binding found - accept literal name 'pino' as fallback
        return identifierName === 'pino';
      }

      const bindingPath = binding.path;

      // Import default: import pino from 'pino'
      if (bindingPath.isImportDefaultSpecifier()) {
        const importDecl = bindingPath.parentPath;
        if (importDecl?.isImportDeclaration()) {
          return importDecl.node.source.value === 'pino';
        }
      }

      // Import namespace: import * as p from 'pino'
      if (bindingPath.isImportNamespaceSpecifier()) {
        const importDecl = bindingPath.parentPath;
        if (importDecl?.isImportDeclaration()) {
          return importDecl.node.source.value === 'pino';
        }
      }

      // Import specifier: import { default as logger } from 'pino'
      if (bindingPath.isImportSpecifier()) {
        const importDecl = bindingPath.parentPath;
        if (importDecl?.isImportDeclaration() && importDecl.node.source.value === 'pino') {
          const imported = bindingPath.node.imported;
          if (t.isIdentifier(imported) && imported.name === 'default') return true;
          if (t.isStringLiteral(imported) && imported.value === 'default') return true;
        }
        return false;
      }

      // Require: const pino = require('pino')
      if (bindingPath.isVariableDeclarator()) {
        const init = bindingPath.node.init;
        if (
          t.isCallExpression(init) &&
          t.isIdentifier(init.callee, { name: 'require' }) &&
          init.arguments.length === 1 &&
          t.isStringLiteral(init.arguments[0]) &&
          init.arguments[0].value === 'pino'
        ) {
          return true;
        }
      }

      return false;
    }

    // Use the default export from @babel/traverse
    const traverseFn = (traverse as unknown as { default: typeof traverse }).default || traverse;

    traverseFn(ast, {
      CallExpression(path) {
        const callee = path.node.callee;

        // Must be member expression like `something.transport`
        if (!t.isMemberExpression(callee)) return;
        if (!t.isIdentifier(callee.property, { name: 'transport' })) return;

        let isPinoCall = false;

        // Handle `pino.transport()` or `logger.transport()` where logger is bound to pino
        if (t.isIdentifier(callee.object)) {
          isPinoCall = isBindingFromPino(path, callee.object.name);
        }
        // Handle `pino.default.transport()` pattern (namespace import interop)
        else if (
          t.isMemberExpression(callee.object) &&
          t.isIdentifier(callee.object.object) &&
          t.isIdentifier(callee.object.property, { name: 'default' })
        ) {
          isPinoCall = isBindingFromPino(path, callee.object.object.name);
        }

        if (!isPinoCall) return;

        // Process first argument which should be the transport config object
        const firstArg = path.node.arguments[0];
        if (firstArg && !t.isSpreadElement(firstArg)) {
          processTransportArgument(firstArg);
        }
      },
    });
  } catch {
    // If parsing fails, return empty set
  }

  return transports;
}
