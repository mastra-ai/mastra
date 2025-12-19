import babel from '@babel/core';
import type { types } from '@babel/core';

const t = babel.types;

/**
 * Finds an ObjectProperty in an array of properties by its key name.
 * This function safely handles SpreadElement nodes which don't have a `key` property.
 *
 * @param properties - The array of object properties (may include SpreadElement nodes)
 * @param keyName - The key name to search for
 * @returns The matching ObjectProperty or undefined if not found
 */
export function findPropertyByKeyName(
  properties: types.ObjectExpression['properties'],
  keyName: string,
): types.ObjectProperty | undefined {
  for (const prop of properties) {
    // Skip SpreadElement nodes - they don't have a key property
    if (!t.isObjectProperty(prop)) {
      continue;
    }

    // Handle both Identifier keys (e.g., { server: ... }) and StringLiteral keys (e.g., { "server": ... })
    if (t.isIdentifier(prop.key) && prop.key.name === keyName) {
      return prop;
    }

    if (t.isStringLiteral(prop.key) && prop.key.value === keyName) {
      return prop;
    }
  }

  return undefined;
}

/**
 * Checks if an ObjectExpression contains a SpreadElement.
 * This is useful for warning users that spread elements cannot be statically analyzed.
 *
 * @param objectExpr - The ObjectExpression to check
 * @returns true if the object contains at least one SpreadElement
 */
export function hasSpreadElement(objectExpr: types.ObjectExpression): boolean {
  return objectExpr.properties.some(prop => t.isSpreadElement(prop));
}
