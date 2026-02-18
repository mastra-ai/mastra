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
import { WorkspaceReadOnlyError } from '../errors';
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
}

interface ImportSpec {
  module: string;
  names: string[];
  isDefault?: boolean;
}

// =============================================================================
// Dynamic Import
// =============================================================================

// Cache the import result so we only try once
let astGrepModule: { parse: any; Lang: any } | null | undefined;

/**
 * Try to load @ast-grep/napi. Returns null if not available.
 * Uses dynamic import to avoid compile-time dependency.
 */
export async function loadAstGrep(): Promise<{ parse: any; Lang: any } | null> {
  if (astGrepModule !== undefined) {
    return astGrepModule;
  }

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
 */
export function getLanguageFromPath(filePath: string, Lang: any): any {
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
      return Lang.TypeScript;
    case 'js':
    case 'jsx':
      return Lang.JavaScript;
    case 'html':
      return Lang.Html;
    case 'css':
      return Lang.Css;
    default:
      return Lang.TypeScript;
  }
}

// =============================================================================
// Transform Functions
// =============================================================================

/**
 * Add an import statement to the file.
 * Inserts after the last existing import, or at the beginning if none exist.
 * If the module is already imported, returns content unchanged.
 */
export function addImport(content: string, root: any, importSpec: ImportSpec): string {
  const { module, names, isDefault } = importSpec;

  const imports = root.findAll({ rule: { kind: 'import_statement' } });

  // Check if import from this module already exists by inspecting node text
  const existingImport = imports.find((imp: any) => {
    const text = imp.text();
    return text.includes(`'${module}'`) || text.includes(`"${module}"`);
  });

  if (existingImport) {
    return content;
  }

  // Build import statement
  let importStatement: string;
  if (isDefault && names.length === 1) {
    importStatement = `import ${names[0]} from '${module}';`;
  } else if (isDefault && names.length > 1) {
    importStatement = `import ${names[0]}, { ${names.slice(1).join(', ')} } from '${module}';`;
  } else {
    importStatement = `import { ${names.join(', ')} } from '${module}';`;
  }

  // Insert after last import or at file start
  if (imports.length > 0) {
    const lastImport = imports[imports.length - 1];
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
export function removeImport(content: string, root: any, targetName: string): string {
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
 * Rename a function — updates declarations, expressions, arrow functions, and call sites.
 * Not scope-aware: renames all occurrences regardless of scope.
 *
 * Uses ast-grep's rule API to find all identifier nodes matching the target name,
 * which reliably handles declarations, call sites, and references across all syntax forms.
 */
export function renameFunction(content: string, root: any, oldName: string, newName: string): TransformResult {
  let modifiedContent = content;
  let count = 0;

  // Find all identifier nodes that exactly match the old name.
  // This covers function declarations, named function expressions, arrow function bindings,
  // call sites, and any other references.
  const identifiers = root.findAll({
    rule: {
      kind: 'identifier',
      regex: `^${oldName}$`,
    },
  });

  const replacements: Replacement[] = [];
  const seen = new Set<number>();

  for (const id of identifiers) {
    const range = id.range();
    // Deduplicate by start position (ast-grep can return overlapping matches)
    if (seen.has(range.start.index)) continue;
    seen.add(range.start.index);
    replacements.push({ start: range.start.index, end: range.end.index, text: newName });
    count++;
  }

  // Sort reverse to preserve positions during replacement
  replacements.sort((a, b) => b.start - a.start);

  for (const { start, end, text } of replacements) {
    modifiedContent = modifiedContent.slice(0, start) + text + modifiedContent.slice(end);
  }

  return { content: modifiedContent, count };
}

/**
 * Rename a variable — replaces all identifier occurrences matching the name.
 * Not scope-aware: renames all occurrences regardless of scope.
 */
export function renameVariable(content: string, root: any, oldName: string, newName: string): TransformResult {
  let modifiedContent = content;
  let count = 0;

  const identifiers = root.findAll({
    rule: {
      kind: 'identifier',
      regex: `^${oldName}$`,
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

/**
 * Pattern-based replacement using AST metavariables.
 * Pattern uses $VARNAME placeholders that match any AST node.
 * Replacement substitutes matched text back in.
 *
 * Falls back to regex if AST pattern matching fails.
 */
export function patternReplace(content: string, root: any, pattern: string, replacement: string): TransformResult {
  let modifiedContent = content;
  let count = 0;

  try {
    const matches = root.findAll({ rule: { pattern } });
    const replacements: Replacement[] = [];

    for (const match of matches) {
      const range = match.range();

      // Extract metavariables from the pattern
      const metaVarRegex = /\$(\w+)/g;
      const metaVars = [...pattern.matchAll(metaVarRegex)].map(m => m[1]);

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
  } catch {
    // Fallback to simple string replacement if pattern matching fails
    const regex = new RegExp(pattern.replace(/\$\w+/g, '(.+)'), 'g');
    modifiedContent = content.replace(regex, replacement);
    count = (content.match(regex) || []).length;
  }

  return { content: modifiedContent, count };
}

// =============================================================================
// Tool Definition
// =============================================================================

export const astEditTool = createTool({
  id: WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT,
  description: `Edit code using AST-based analysis for intelligent transformations.

Supports:
- Pattern-based search and replace with syntax awareness (using $METAVAR placeholders)
- Add/remove imports
- Rename functions (declarations + call sites)
- Rename variables (all identifier occurrences)

Examples:
- Add import: { path: "src/app.ts", transform: "add-import", importSpec: { module: "react", names: ["useState"] } }
- Rename function: { path: "src/utils.ts", transform: "rename-function", targetName: "oldFunc", newName: "newFunc" }
- Pattern replace: { path: "src/utils.ts", pattern: "console.log($ARG)", replacement: "logger.debug($ARG)" }`,
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
      .enum(['add-import', 'remove-import', 'rename-function', 'rename-variable'])
      .optional()
      .describe('Structured transformation to apply'),
    targetName: z
      .string()
      .optional()
      .describe('Target name for rename/remove transforms (e.g., the current function name)'),
    newName: z.string().optional().describe('New name for rename transforms'),
    importSpec: z
      .object({
        module: z.string().describe('Module to import from'),
        names: z.array(z.string()).describe('Names to import'),
        isDefault: z.boolean().optional().describe('Whether the first name is a default import'),
      })
      .optional()
      .describe('Import specification for add-import transform'),
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
    const content = await filesystem.readFile(path, { encoding: 'utf-8' });

    if (typeof content !== 'string') {
      return `Cannot perform AST edits on binary files. Use ${WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE} instead.`;
    }

    // Parse AST
    const lang = getLanguageFromPath(path, Lang);
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

        case 'rename-function': {
          if (!targetName || !newName) {
            return 'Error: targetName and newName are required for rename-function transform';
          }
          const funcResult = renameFunction(content, root, targetName, newName);
          modifiedContent = funcResult.content;
          changes.push(`Renamed function '${targetName}' to '${newName}' (${funcResult.count} occurrences)`);
          break;
        }

        case 'rename-variable': {
          if (!targetName || !newName) {
            return 'Error: targetName and newName are required for rename-variable transform';
          }
          const varResult = renameVariable(content, root, targetName, newName);
          modifiedContent = varResult.content;
          changes.push(`Renamed variable '${targetName}' to '${newName}' (${varResult.count} occurrences)`);
          break;
        }
      }
    } else if (pattern && replacement !== undefined) {
      const result = patternReplace(content, root, pattern, replacement);
      modifiedContent = result.content;
      changes.push(`Replaced ${result.count} occurrences of pattern`);
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
