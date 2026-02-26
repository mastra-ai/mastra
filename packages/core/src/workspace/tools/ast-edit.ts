/**
 * AST Edit Tool
 *
 * Provides AST-aware code transformations for workspace files.
 * Uses @ast-grep/napi for syntax-aware pattern matching and transforms.
 *
 * Requires @ast-grep/napi as an optional peer dependency.
 */

import { createRequire } from 'node:module';

import { z } from 'zod';

import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { FileNotFoundError, WorkspaceReadOnlyError } from '../errors';
import { emitWorkspaceMetadata, getEditDiagnosticsText, requireFilesystem } from './helpers';

// =============================================================================
// Types
// =============================================================================

interface Replacement {
  start: number;
  end: number;
  text: string;
}

interface TransformResult {
  content: string;
  count: number;
  error?: string;
}

interface ImportSpec {
  module: string;
  names: string[];
  isDefault?: boolean;
}

/**
 * Minimal interface for an ast-grep SgNode.
 * Avoids importing @ast-grep/napi types directly since it's an optional dep.
 */
interface SgNode {
  text(): string;
  range(): { start: { index: number }; end: { index: number } };
  findAll(config: { rule: Record<string, unknown> }): SgNode[];
  getMatch(name: string): SgNode | null;
}

/** Minimal interface for the ast-grep Lang enum values. */
type LangValue = unknown;

/** The subset of @ast-grep/napi we use after dynamic import. */
interface AstGrepModule {
  parse(lang: LangValue, content: string): { root(): SgNode };
  Lang: Record<string, LangValue>;
}

// =============================================================================
// Dynamic Import
// =============================================================================

// Cache the import result so we only try once
let astGrepModule: AstGrepModule | null | undefined;
let loadingPromise: Promise<AstGrepModule | null> | undefined;

/**
 * Try to load @ast-grep/napi. Returns null if not available.
 * Uses dynamic import to avoid compile-time dependency.
 * Concurrent callers share the same in-flight promise.
 */
export async function loadAstGrep(): Promise<AstGrepModule | null> {
  if (astGrepModule !== undefined) {
    return astGrepModule;
  }
  if (!loadingPromise) {
    loadingPromise = (async () => {
      try {
        // Dynamic import with string concatenation to prevent bundlers from resolving at build time
        const moduleName = '@ast-grep' + '/napi';
        const mod = await import(/* webpackIgnore: true */ moduleName);
        astGrepModule = { parse: mod.parse, Lang: mod.Lang };
        return astGrepModule;
      } catch {
        astGrepModule = null;
        return null;
      }
    })();
  }
  return loadingPromise;
}

/**
 * Check if @ast-grep/napi is available without importing it.
 * Useful for deciding whether to create the tool at registration time.
 */
export function isAstGrepAvailable(): boolean {
  if (astGrepModule !== undefined) {
    return astGrepModule !== null;
  }

  try {
    const req = createRequire(import.meta.url);
    req.resolve('@ast-grep/napi');
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// Language Detection
// =============================================================================

/**
 * Map file extension to ast-grep Lang enum.
 *
 * Only languages with built-in tree-sitter grammars in @ast-grep/napi are
 * supported. Python, Go, Rust, etc. require separate @ast-grep/lang-* packages
 * which are not currently integrated.
 */
export function getLanguageFromPath(filePath: string, Lang: Record<string, LangValue>): LangValue | null {
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
      return Lang.TypeScript;
    case 'tsx':
    case 'jsx':
      return Lang.Tsx;
    case 'js':
      return Lang.JavaScript;
    case 'html':
      return Lang.Html;
    case 'css':
      return Lang.Css;
    default:
      return null;
  }
}

// =============================================================================
// Helpers
// =============================================================================

/** Escape regex metacharacters in a string. */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Rename all identifier occurrences matching `oldName` to `newName`.
 * Not scope-aware: renames all occurrences regardless of scope.
 */
function renameIdentifiers(content: string, root: SgNode, oldName: string, newName: string): TransformResult {
  let modifiedContent = content;
  let count = 0;

  const identifiers = root.findAll({
    rule: {
      kind: 'identifier',
      regex: `^${escapeRegex(oldName)}$`,
    },
  });

  const replacements: Replacement[] = [];
  const seen = new Set<number>();

  for (const id of identifiers) {
    const range = id.range();
    if (seen.has(range.start.index)) continue;
    seen.add(range.start.index);
    replacements.push({ start: range.start.index, end: range.end.index, text: newName });
    count++;
  }

  replacements.sort((a, b) => b.start - a.start);

  for (const { start, end, text } of replacements) {
    modifiedContent = modifiedContent.slice(0, start) + text + modifiedContent.slice(end);
  }

  return { content: modifiedContent, count };
}

// =============================================================================
// Transform Functions
// =============================================================================

/**
 * Build an import statement string from its parts.
 */
function buildImportStatement(defaultName: string | null, namedImports: string[], moduleStr: string): string {
  if (defaultName && namedImports.length > 0) {
    return `import ${defaultName}, { ${namedImports.join(', ')} } from ${moduleStr};`;
  } else if (defaultName) {
    return `import ${defaultName} from ${moduleStr};`;
  } else {
    return `import { ${namedImports.join(', ')} } from ${moduleStr};`;
  }
}

/**
 * Merge new names into an existing import statement.
 * Returns null if nothing needs to change.
 */
function mergeIntoExistingImport(
  content: string,
  existingImport: SgNode,
  names: string[],
  isDefault?: boolean,
): string | null {
  const text = existingImport.text();

  // Namespace imports (import * as X from 'mod') cannot be merged into
  if (/^import\s+\*\s+as\s+/.test(text)) return null;

  // Parse existing structure from the import text
  // Matches: import [default] [, { named }] from 'module'
  const defaultMatch = text.match(/^import\s+(?!type\s)(?!\{)(\w+)/);
  const namedMatch = text.match(/\{([^}]*)\}/);
  const moduleMatch = text.match(/(["'][^"']+["'])\s*;?\s*$/);

  if (!moduleMatch) return null;
  const moduleStr = moduleMatch[1] ?? '';

  let existingDefault = defaultMatch ? (defaultMatch[1] ?? null) : null;
  const existingNamed = namedMatch
    ? (namedMatch[1] ?? '')
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean)
    : [];

  let newDefault = existingDefault;
  const newNamed = [...existingNamed];

  if (isDefault && names.length > 0) {
    // First name is the default import
    if (!existingDefault) {
      newDefault = names[0] ?? null;
    }
    // Remaining names are named imports
    for (const name of names.slice(1)) {
      if (!newNamed.includes(name)) {
        newNamed.push(name);
      }
    }
  } else {
    for (const name of names) {
      if (!newNamed.includes(name)) {
        newNamed.push(name);
      }
    }
  }

  // Check if anything changed
  const defaultChanged = newDefault !== existingDefault;
  const namedChanged = newNamed.length !== existingNamed.length;
  if (!defaultChanged && !namedChanged) return null;

  const importStatement = buildImportStatement(newDefault, newNamed, moduleStr);
  const range = existingImport.range();
  return content.slice(0, range.start.index) + importStatement + content.slice(range.end.index);
}

/**
 * Add an import statement to the file.
 * Inserts after the last existing import, or at the beginning if none exist.
 * If the module is already imported, merges new names into it.
 */
export function addImport(content: string, root: SgNode, importSpec: ImportSpec): string {
  const { module, names, isDefault } = importSpec;

  const imports = root.findAll({ rule: { kind: 'import_statement' } });

  // Check if a mergeable import from this module already exists.
  // Skip type-only and namespace imports — they can't be merged with value imports.
  const existingImport = imports.find(imp => {
    const text = imp.text();
    if (/^import\s+type\s/.test(text)) return false;
    if (/^import\s+\*\s+as\s+/.test(text)) return false;
    return text.includes(`'${module}'`) || text.includes(`"${module}"`);
  });

  if (existingImport) {
    // Try to merge new names into the existing import
    return mergeIntoExistingImport(content, existingImport, names, isDefault) ?? content;
  }

  // Build new import statement
  const moduleStr = `'${module}'`;
  const importStatement = buildImportStatement(
    isDefault ? names[0]! : null,
    isDefault ? names.slice(1) : names,
    moduleStr,
  );

  // Insert after last import or at file start
  const lastImport = imports.at(-1);
  if (lastImport) {
    const pos = lastImport.range().end.index;
    return content.slice(0, pos) + '\n' + importStatement + content.slice(pos);
  } else {
    return importStatement + '\n\n' + content;
  }
}

/**
 * Remove an import by module name.
 * Matches against the import source string.
 */
export function removeImport(content: string, root: SgNode, targetName: string): string {
  const imports = root.findAll({ rule: { kind: 'import_statement' } });

  for (const imp of imports) {
    const text = imp.text();
    if (text.includes(`'${targetName}'`) || text.includes(`"${targetName}"`)) {
      const range = imp.range();
      const start = range.start.index;
      let end = range.end.index;
      // Remove trailing newline if present
      if (content[end] === '\n') end++;
      return content.slice(0, start) + content.slice(end);
    }
  }

  return content;
}

/**
 * Pattern-based replacement using AST metavariables.
 * Pattern uses $VARNAME placeholders that match any AST node.
 * Replacement substitutes matched text back in.
 */
export function patternReplace(content: string, root: SgNode, pattern: string, replacement: string): TransformResult {
  let modifiedContent = content;
  let count = 0;

  try {
    const matches = root.findAll({ rule: { pattern } });
    const replacements: Replacement[] = [];

    // Extract metavariables from the pattern once (constant across all matches)
    const metaVars = [...pattern.matchAll(/\$(\w+)/g)].map(m => m[1]).filter((v): v is string => v !== undefined);

    for (const match of matches) {
      const range = match.range();

      // Build replacement text with variable substitution
      let replacementText = replacement;
      for (const varName of metaVars) {
        const matchedNode = match.getMatch(varName);
        if (matchedNode) {
          replacementText = replacementText.replace(new RegExp(`\\$${varName}`, 'g'), matchedNode.text());
        }
      }

      replacements.push({ start: range.start.index, end: range.end.index, text: replacementText });
      count++;
    }

    replacements.sort((a, b) => b.start - a.start);

    for (const { start, end, text } of replacements) {
      modifiedContent = modifiedContent.slice(0, start) + text + modifiedContent.slice(end);
    }
  } catch (err) {
    return {
      content: modifiedContent,
      count: 0,
      error: err instanceof Error ? err.message : 'Pattern matching failed',
    };
  }

  return { content: modifiedContent, count };
}

// =============================================================================
// Tool Definition
// =============================================================================

export const astEditTool = createTool({
  id: WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT,
  description: `Edit code using AST-based analysis for intelligent transformations.

Use \`transform\` for structured operations (imports, renames). Use \`pattern\`/\`replacement\` only for general find-and-replace.

Transforms:
- add-import: Add or merge imports. Skips duplicates. For default imports, put the default name first in \`names\`.
  { transform: "add-import", importSpec: { module: "react", names: ["useState", "useEffect"] } }
  { transform: "add-import", importSpec: { module: "express", names: ["express"], isDefault: true } }
  { transform: "add-import", importSpec: { module: "express", names: ["express", "Router"], isDefault: true } } → import express, { Router } from 'express'
- remove-import: Remove an import by module name.
  { transform: "remove-import", targetName: "lodash" }
- rename: Rename all occurrences of an identifier (not scope-aware).
  { transform: "rename", targetName: "oldName", newName: "newName" }

Pattern replace (for everything else):
  { pattern: "console.log($ARG)", replacement: "logger.debug($ARG)" }`,
  inputSchema: z.object({
    path: z.string().describe('The path to the file to edit'),
    pattern: z
      .string()
      .optional()
      .describe('AST pattern to search for (supports $VARIABLE placeholders, e.g., "console.log($ARG)")'),
    replacement: z
      .string()
      .optional()
      .describe('Replacement pattern (can use captured $VARIABLES, e.g., "logger.debug($ARG)")'),
    transform: z
      .enum(['add-import', 'remove-import', 'rename'])
      .optional()
      .describe('Structured transformation to apply'),
    targetName: z
      .string()
      .optional()
      .describe('Required for remove-import and rename transforms. The current name to target.'),
    newName: z.string().optional().describe('Required for rename transform. The new name to replace targetName with.'),
    importSpec: z
      .object({
        module: z.string().describe('Module to import from'),
        names: z.array(z.string()).min(1).describe('Names to import. For default imports, put the default name first.'),
        isDefault: z.boolean().optional().describe('Whether the first name is a default import'),
      })
      .optional()
      .describe('Required for add-import transform. Specifies the module and names to import.'),
  }),
  execute: async ({ path, pattern, replacement, transform, targetName, newName, importSpec }, context) => {
    const { workspace, filesystem } = requireFilesystem(context);
    await emitWorkspaceMetadata(context, WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT);

    if (filesystem.readOnly) {
      throw new WorkspaceReadOnlyError('ast_edit');
    }

    // Load ast-grep (cached after first call)
    const astGrep = await loadAstGrep();
    if (!astGrep) {
      return '@ast-grep/napi is not available. Install it to use AST editing.';
    }
    const { parse, Lang } = astGrep;

    // Read current content
    let content: string | Buffer;
    try {
      content = await filesystem.readFile(path, { encoding: 'utf-8' });
    } catch (error) {
      if (error instanceof FileNotFoundError) {
        return `File not found: ${path}. Use ${WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE} to create it first.`;
      }
      throw error;
    }

    if (typeof content !== 'string') {
      return `Cannot perform AST edits on binary files. Use ${WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE} instead.`;
    }

    // Parse AST
    const lang = getLanguageFromPath(path, Lang);
    if (!lang) {
      return `Unsupported file type for AST editing: ${path}`;
    }
    const ast = parse(lang, content);
    const root = ast.root();

    let modifiedContent = content;
    const changes: string[] = [];

    if (transform) {
      switch (transform) {
        case 'add-import': {
          if (!importSpec) {
            return 'Error: importSpec is required for add-import transform';
          }
          modifiedContent = addImport(content, root, importSpec);
          changes.push(`Added import from '${importSpec.module}'`);
          break;
        }

        case 'remove-import': {
          if (!targetName) {
            return 'Error: targetName is required for remove-import transform';
          }
          modifiedContent = removeImport(content, root, targetName);
          changes.push(`Removed import '${targetName}'`);
          break;
        }

        case 'rename': {
          if (!targetName || !newName) {
            return 'Error: targetName and newName are required for rename transform';
          }
          const renameResult = renameIdentifiers(content, root, targetName, newName);
          modifiedContent = renameResult.content;
          changes.push(`Renamed '${targetName}' to '${newName}' (${renameResult.count} occurrences)`);
          break;
        }
      }
    } else if (pattern && replacement !== undefined) {
      const result = patternReplace(content, root, pattern, replacement);
      if (result.error) {
        return `Error: AST pattern matching failed: ${result.error}`;
      }
      modifiedContent = result.content;
      changes.push(`Replaced ${result.count} occurrences of pattern`);
    } else if (pattern && replacement === undefined) {
      return 'Error: replacement is required when pattern is provided';
    } else if (!pattern && replacement !== undefined) {
      return 'Error: pattern is required when replacement is provided';
    } else {
      return 'Error: Must provide either transform or pattern/replacement';
    }

    // Write back if modified
    const wasModified = modifiedContent !== content;
    if (wasModified) {
      await filesystem.writeFile(path, modifiedContent, { overwrite: true });
    }

    if (!wasModified) {
      return `No changes made to ${path} (${changes.join('; ')})`;
    }

    let output = `${path}: ${changes.join('; ')}`;
    output += await getEditDiagnosticsText(workspace, path, modifiedContent);
    return output;
  },
});
