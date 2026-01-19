// Shared utility functions for codemods

import type { Collection, JSCodeshift } from 'jscodeshift';

/**
 * Efficiently tracks instances of a specific class by finding all `new ClassName()` expressions
 * and extracting the variable names they're assigned to.
 *
 * @param j - JSCodeshift API
 * @param root - Root collection
 * @param className - Name of the class to track
 * @returns Set of variable names that are instances of the class
 */
export function trackClassInstances(j: JSCodeshift, root: Collection<any>, className: string): Set<string> {
  const instances = new Set<string>();

  root
    .find(j.NewExpression, {
      callee: {
        type: 'Identifier',
        name: className,
      },
    })
    .forEach(path => {
      const parent = path.parent.value;
      if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
        instances.add(parent.id.name);
      }
    });

  return instances;
}

/**
 * Efficiently tracks instances of multiple classes in a single pass.
 * This is optimized for codemods that need to track several store types or class variants.
 *
 * @param j - JSCodeshift API
 * @param root - Root collection
 * @param classNames - Array of class names to track
 * @returns Set of variable names that are instances of any of the classes
 */
export function trackMultipleClassInstances(j: JSCodeshift, root: Collection<any>, classNames: string[]): Set<string> {
  const instances = new Set<string>();
  const classNameSet = new Set(classNames);

  root.find(j.NewExpression).forEach(path => {
    const { callee } = path.value;
    if (callee.type !== 'Identifier') return;
    if (!classNameSet.has(callee.name)) return;

    const parent = path.parent.value;
    if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
      instances.add(parent.id.name);
    }
  });

  return instances;
}

/**
 * Efficiently finds and transforms method calls on tracked instances.
 * This combines finding, filtering, and transforming in a single pass.
 *
 * @param j - JSCodeshift API
 * @param root - Root collection
 * @param instances - Set of instance variable names to track
 * @param methodName - Name of the method to find (or undefined to match any method)
 * @param transform - Callback to transform matching call expressions
 * @returns Number of transformations made
 */
export function transformMethodCalls(
  j: JSCodeshift,
  root: Collection<any>,
  instances: Set<string>,
  methodName: string | undefined,
  transform: (path: any) => void,
): number {
  if (instances.size === 0) return 0;

  let count = 0;

  root.find(j.CallExpression).forEach(path => {
    const { callee } = path.value;
    if (callee.type !== 'MemberExpression') return;
    if (callee.object.type !== 'Identifier') return;
    if (callee.property.type !== 'Identifier') return;

    // Only process if called on a tracked instance
    if (!instances.has(callee.object.name)) return;

    // Only process if it's the method we want (or any method if undefined)
    if (methodName && callee.property.name !== methodName) return;

    transform(path);
    count++;
  });

  return count;
}

/**
 * Renames a method on tracked instances efficiently in a single pass.
 *
 * @param j - JSCodeshift API
 * @param root - Root collection
 * @param instances - Set of instance variable names to track
 * @param oldMethodName - Current method name
 * @param newMethodName - New method name
 * @returns Number of renames performed
 */
export function renameMethod(
  j: JSCodeshift,
  root: Collection<any>,
  instances: Set<string>,
  oldMethodName: string,
  newMethodName: string,
): number {
  if (instances.size === 0) return 0;

  let count = 0;

  root.find(j.CallExpression).forEach(path => {
    const { callee } = path.value;
    if (callee.type !== 'MemberExpression') return;
    if (callee.object.type !== 'Identifier') return;
    if (callee.property.type !== 'Identifier') return;

    // Only process if called on tracked instance
    if (!instances.has(callee.object.name)) return;

    // Only process if it's the method we want to rename
    if (callee.property.name !== oldMethodName) return;

    callee.property.name = newMethodName;
    count++;
  });

  return count;
}

/**
 * Renames multiple methods on tracked instances in a single pass.
 *
 * @param j - JSCodeshift API
 * @param root - Root collection
 * @param instances - Set of instance variable names to track
 * @param methodRenames - Map of old method names to new method names
 * @returns Number of renames performed
 */
export function renameMethods(
  j: JSCodeshift,
  root: Collection<any>,
  instances: Set<string>,
  methodRenames: Record<string, string>,
): number {
  if (instances.size === 0) return 0;

  let count = 0;

  root.find(j.CallExpression).forEach(path => {
    const { callee } = path.value;
    if (callee.type !== 'MemberExpression') return;
    if (callee.object.type !== 'Identifier') return;
    if (callee.property.type !== 'Identifier') return;

    // Only process if called on tracked instance
    if (!instances.has(callee.object.name)) return;

    // Check if this is one of the methods we want to rename
    const oldName = callee.property.name;
    const newName = methodRenames[oldName];

    if (newName) {
      callee.property.name = newName;
      count++;
    }
  });

  return count;
}

/**
 * Transforms object properties in method call arguments.
 * This is a helper for codemods that need to rename properties in object arguments.
 *
 * @param obj - Object expression to transform
 * @param propertyRenames - Map of old property names to new property names
 * @returns Number of properties renamed
 */
export function transformObjectProperties(obj: any, propertyRenames: Record<string, string>): number {
  let count = 0;

  const recurse = (o: any) => {
    if (!o.properties) return;

    o.properties.forEach((prop: any) => {
      if ((prop.type === 'Property' || prop.type === 'ObjectProperty') && prop.key?.type === 'Identifier') {
        const oldName = prop.key.name;
        const newName = propertyRenames[oldName];

        if (newName) {
          prop.key.name = newName;
          count++;
        }

        // Recursively transform nested objects
        if (prop.value?.type === 'ObjectExpression') {
          recurse(prop.value);
        }
      }
    });
  };

  recurse(obj);
  return count;
}

/**
 * Checks if a node is a member expression accessing a specific property on tracked instances.
 *
 * @param node - AST node to check
 * @param instances - Set of instance variable names to track
 * @param propertyName - Property name to match (or undefined to match any property)
 * @returns true if the node matches
 */
export function isMemberExpressionOnInstance(node: any, instances: Set<string>, propertyName?: string): boolean {
  if (node.type !== 'MemberExpression') return false;
  if (node.object.type !== 'Identifier') return false;
  if (!instances.has(node.object.name)) return false;

  if (propertyName && node.property.type === 'Identifier' && node.property.name !== propertyName) {
    return false;
  }

  return true;
}

/**
 * Renames an import and all its usages in a single optimized pass.
 * Handles aliased imports correctly - only transforms usages for non-aliased imports.
 * Handles multiple imports of the same name (with different aliases) correctly.
 *
 * For non-aliased imports: Renames both import and all usages
 *   import { oldName } → import { newName }
 *   oldName() → newName()
 *
 * For aliased imports: Only renames the import, keeps alias in usages
 *   import { oldName as alias } → import { newName as alias }
 *   alias() → alias() (unchanged)
 *
 * @param j - JSCodeshift API
 * @param root - Root collection
 * @param packageName - Package to import from (e.g., '@mastra/core/evals')
 * @param oldName - Current import name
 * @param newName - New import name
 * @returns Number of changes made
 */
export function renameImportAndUsages(
  j: JSCodeshift,
  root: Collection<any>,
  packageName: string,
  oldName: string,
  newName: string,
): number {
  let changes = 0;
  const localNamesToReplace = new Set<string>();

  // First: Transform import specifiers from the specific package and collect local names to replace
  root
    .find(j.ImportDeclaration)
    .filter(path => {
      const source = path.value.source.value;
      return typeof source === 'string' && source === packageName;
    })
    .forEach(path => {
      if (!path.value.specifiers) return;

      path.value.specifiers.forEach((specifier: any) => {
        if (
          specifier.type === 'ImportSpecifier' &&
          specifier.imported.type === 'Identifier' &&
          specifier.imported.name === oldName
        ) {
          const isAliased = specifier.local && specifier.local.name !== oldName;

          // Always rename the imported name
          specifier.imported.name = newName;
          changes++;

          // Only rename the local name and track for usage replacement if NOT aliased
          if (!isAliased) {
            if (specifier.local) {
              specifier.local.name = newName;
            }
            // Track for usage replacement (only non-aliased imports)
            localNamesToReplace.add(oldName);
          }
        }
      });
    });

  // Second: Transform usages only for non-aliased imports
  localNamesToReplace.forEach(localName => {
    root.find(j.Identifier, { name: localName }).forEach(path => {
      // Skip identifiers that are part of import declarations
      const parent = path.parent;
      if (parent && parent.value.type === 'ImportSpecifier') {
        return;
      }

      path.value.name = newName;
      changes++;
    });
  });

  return changes;
}

/**
 * Tracks variables assigned from method calls on tracked instances.
 * Useful for tracking objects returned from factory methods like `client.getAgent()`.
 *
 * @param j - JSCodeshift API
 * @param root - Root collection
 * @param instances - Set of instance variable names to track
 * @param methodName - Name of the method to track (or undefined to match any method)
 * @returns Set of variable names that are assigned from the method calls
 */
export function trackMethodCallResults(
  j: JSCodeshift,
  root: Collection<any>,
  instances: Set<string>,
  methodName?: string,
): Set<string> {
  const results = new Set<string>();

  if (instances.size === 0) return results;

  root.find(j.CallExpression).forEach(path => {
    const { callee } = path.value;
    if (callee.type !== 'MemberExpression') return;
    if (callee.object.type !== 'Identifier') return;
    if (callee.property.type !== 'Identifier') return;

    // Only process if called on a tracked instance
    if (!instances.has(callee.object.name)) return;

    // Only process if it's the method we want (or any method if undefined)
    if (methodName && callee.property.name !== methodName) return;

    // Track the variable this is assigned to
    const parent = path.parent.value;
    if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
      results.add(parent.id.name);
    }
  });

  return results;
}

/**
 * Transforms properties in constructor call arguments.
 *
 * @param j - JSCodeshift API
 * @param root - Root collection
 * @param className - Name of the class whose constructor to transform
 * @param propertyRenames - Map of old property names to new property names
 * @returns Number of properties renamed
 */
export function transformConstructorProperties(
  j: JSCodeshift,
  root: Collection<any>,
  className: string,
  propertyRenames: Record<string, string>,
): number {
  let count = 0;

  root
    .find(j.NewExpression, {
      callee: { type: 'Identifier', name: className },
    })
    .forEach(path => {
      const args = path.value.arguments;
      if (args.length === 0) return;

      const firstArg = args[0];
      if (!firstArg || firstArg.type !== 'ObjectExpression' || !firstArg.properties) return;

      firstArg.properties.forEach((prop: any) => {
        if ((prop.type === 'Property' || prop.type === 'ObjectProperty') && prop.key?.type === 'Identifier') {
          const oldName = prop.key.name;
          const newName = propertyRenames[oldName];

          if (newName) {
            prop.key.name = newName;
            count++;
          }
        }
      });
    });

  return count;
}
