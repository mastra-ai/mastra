import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript-classic';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { SERVER_ERROR_METADATA_SCHEMAS } from './metadata';
import { isServerErrorCode } from './index';

const CORE_SRC = join(__dirname, '../../../../core/src');

// Core errors that expose their data on a dedicated property, which the item-write handlers
// (ADD_ITEM_ROUTE and BATCH_INSERT_ITEMS_ROUTE) turn into metadata themselves.
const REBUILT_BY_HANDLERS = new Set(['DATASET_ITEM_IDENTITY_CONFLICT']);

type CoreThrow = { code: string; site: string; detailKeys: Set<string> | undefined };

function stringProperty(node: ts.ObjectLiteralExpression, name: string): ts.Expression | undefined {
  for (const property of node.properties) {
    if (ts.isPropertyAssignment(property) && property.name.getText() === name) return property.initializer;
  }
  return undefined;
}

/** Every object literal in core source with an `id` that is a server error code. */
function coreThrows(): CoreThrow[] {
  const found: CoreThrow[] = [];
  for (const entry of readdirSync(CORE_SRC, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !/\.ts$/.test(entry.name) || /\.test\.ts$/.test(entry.name)) continue;
    const file = join(entry.parentPath, entry.name);
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node) => {
      if (ts.isObjectLiteralExpression(node)) {
        const id = stringProperty(node, 'id');
        if (id && ts.isStringLiteralLike(id) && isServerErrorCode(id.text)) {
          const details = stringProperty(node, 'details');
          const detailKeys =
            details && ts.isObjectLiteralExpression(details)
              ? new Set(details.properties.map(property => property.name?.getText() ?? ''))
              : undefined;
          const { line } = source.getLineAndCharacterOfPosition(node.getStart());
          found.push({ code: id.text, site: `${relative(CORE_SRC, file)}:${line + 1}`, detailKeys });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return found;
}

function requiredKeys(schema: z.ZodType): string[] | undefined {
  if (schema.safeParse(undefined).success || !(schema instanceof z.ZodObject)) return undefined;
  return Object.entries(schema.shape as Record<string, z.ZodType>)
    .filter(([, field]) => !field.safeParse(undefined).success)
    .map(([key]) => key);
}

describe('SERVER_ERROR_METADATA_SCHEMAS', () => {
  // Handlers forward a core error id as the business code and its `details` as metadata, so a
  // core throw must carry every field the code's metadata requires. (Older cores in the peer
  // range don't; dataset handlers cover that by filling the ids from the route.)
  it('core errors thrown with a server code carry the metadata the code requires', () => {
    const throws = coreThrows();
    expect(throws.length).toBeGreaterThan(0);

    const missing = throws.flatMap(({ code, site, detailKeys }) => {
      if (REBUILT_BY_HANDLERS.has(code)) return [];
      const schema = SERVER_ERROR_METADATA_SCHEMAS[code as keyof typeof SERVER_ERROR_METADATA_SCHEMAS];
      const keys = schema ? requiredKeys(schema) : undefined;
      const absent = keys?.filter(key => !detailKeys?.has(key)) ?? [];
      return absent.length > 0 ? [`${code} at ${site} lacks details.${absent.join(', details.')}`] : [];
    });

    expect(missing).toEqual([]);
  });
});
