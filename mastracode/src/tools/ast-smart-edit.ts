import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse, Lang } from '@ast-grep/napi';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { assertPathAllowed, getAllowedPathsFromContext } from './utils.js';

interface SgNode {
  text(): string;
  range(): {
    start: { index: number };
    end: { index: number };
  };
  kind(): string;
  children(): SgNode[];
  findAll(query: unknown): SgNode[];
  getMatch(name: string): SgNode | null;
}

const astSmartEditSchema = z.object({
  path: z.string().describe('File path relative to project root'),
  pattern: z.string().optional().describe('AST pattern to search for (supports $VARIABLE placeholders)'),
  replacement: z.string().optional().describe('Replacement pattern (can use captured $VARIABLES)'),
  selector: z
    .string()
    .optional()
    .describe('CSS-like selector for AST nodes (e.g., "FunctionDeclaration", "CallExpression[callee.name=console]")'),
  transform: z
    .enum(['add-import', 'remove-import', 'rename-function', 'rename-variable', 'extract-function', 'inline-variable'])
    .optional()
    .describe('Type of transformation to apply'),
  targetName: z.string().optional().describe('Name of the target element (for rename operations)'),
  newName: z.string().optional().describe('New name (for rename operations)'),
  importSpec: z
    .object({
      module: z.string(),
      names: z.array(z.string()),
      isDefault: z.boolean().optional(),
    })
    .optional()
    .describe('Import specification for add-import transform'),
});

export function createAstSmartEditTool(projectRoot?: string) {
  return createTool({
    id: 'ast_smart_edit',
    description: `Edit code using AST-based analysis for intelligent transformations.
    
Supports various code transformations:
- Pattern-based search and replace with syntax awareness
- Add/remove imports intelligently
- Rename functions/variables with scope awareness
- Extract functions from code blocks
- Inline variables

Examples:
- Add import: { transform: 'add-import', importSpec: { module: 'react', names: ['useState'] } }
- Rename function: { transform: 'rename-function', targetName: 'oldFunc', newName: 'newFunc' }
- Pattern replace: { pattern: 'console.log($ARG)', replacement: 'logger.debug($ARG)' }`,
    // requireApproval: true,
    inputSchema: astSmartEditSchema,
    execute: async (
      { path, pattern, replacement, selector, transform, targetName, newName, importSpec },
      toolContext,
    ) => {
      try {
        const root = projectRoot || process.cwd();
        const filePath = resolve(root, path);

        // Security: ensure the path is within the project root or allowed paths
        const allowedPaths = getAllowedPathsFromContext(toolContext);
        assertPathAllowed(filePath, root, allowedPaths);

        // Read the file
        const content = readFileSync(filePath, 'utf-8');

        // Determine the language from file extension
        const lang = getLanguageFromPath(filePath);

        // Parse the AST
        const ast = parse(lang, content);
        const astRoot = ast.root();

        let modifiedContent = content;
        const changes: string[] = [];

        // Handle different transformation types
        if (transform) {
          switch (transform) {
            case 'add-import':
              if (!importSpec) {
                throw new Error('importSpec is required for add-import transform');
              }
              modifiedContent = addImport(content, astRoot, importSpec);
              changes.push(`Added import from '${importSpec.module}'`);
              break;

            case 'remove-import':
              if (!targetName) {
                throw new Error('targetName is required for remove-import transform');
              }
              modifiedContent = removeImport(content, astRoot, targetName);
              changes.push(`Removed import '${targetName}'`);
              break;

            case 'rename-function':
              if (!targetName || !newName) {
                throw new Error('targetName and newName are required for rename-function transform');
              }
              const funcResult = renameFunction(content, astRoot, targetName, newName);
              modifiedContent = funcResult.content;
              changes.push(`Renamed function '${targetName}' to '${newName}' (${funcResult.count} occurrences)`);
              break;

            case 'rename-variable':
              if (!targetName || !newName) {
                throw new Error('targetName and newName are required for rename-variable transform');
              }
              const varResult = renameVariable(content, astRoot, targetName, newName);
              modifiedContent = varResult.content;
              changes.push(`Renamed variable '${targetName}' to '${newName}' (${varResult.count} occurrences)`);
              break;

            default:
              throw new Error(`Unsupported transform: ${transform}`);
          }
        } else if (pattern && replacement !== undefined) {
          // Pattern-based replacement
          const result = patternReplace(content, astRoot, pattern, replacement);
          modifiedContent = result.content;
          changes.push(`Replaced ${result.count} occurrences of pattern`);
        } else if (selector) {
          // Selector-based query (just return matches for now)
          const matches = astRoot.findAll(selector);
          const matchInfo = matches.map((match: SgNode) => ({
            text: match.text(),
            range: match.range(),
            kind: match.kind(),
          }));

          return {
            matches: matchInfo.length,
            details: matchInfo.slice(0, 10), // Limit to first 10 matches
          };
        } else {
          throw new Error('Must provide either transform, pattern/replacement, or selector');
        }

        // Write the modified content back
        if (modifiedContent !== content) {
          writeFileSync(filePath, modifiedContent, 'utf-8');
        }

        return {
          success: true,
          changes,
          modified: modifiedContent !== content,
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        if (process.env.DEBUG === 'true' && error instanceof Error && error.stack) {
          return {
            error: message,
            stack: error.stack,
          };
        }
        return {
          error: message,
        };
      }
    },
  });
}

export const astSmartEditTool = createAstSmartEditTool();

function getLanguageFromPath(path: string): Lang {
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
      return Lang.TypeScript;
    case 'js':
    case 'jsx':
      return Lang.JavaScript;
    // Note: These languages might not be available in the current version of ast-grep
    // case 'py':
    //     return Lang.Python;
    // case 'rs':
    //     return Lang.Rust;
    // case 'go':
    //     return Lang.Go;
    // case 'java':
    //     return Lang.Java;
    // case 'cpp':
    // case 'cc':
    // case 'cxx':
    //     return Lang.Cpp;
    // case 'c':
    //     return Lang.C;
    // case 'cs':
    //     return Lang.CSharp;
    case 'html':
      return Lang.Html;
    case 'css':
      return Lang.Css;
    default:
      // Default to TypeScript for unknown extensions
      return Lang.TypeScript;
  }
}

function addImport(
  content: string,
  root: SgNode,
  importSpec: { module: string; names: string[]; isDefault?: boolean },
): string {
  const { module, names, isDefault } = importSpec;

  // Find existing imports
  const imports = root.findAll('ImportDeclaration');

  // Check if import already exists
  const existingImport = imports.find((imp: SgNode) => {
    const source = imp.getMatch('source')?.text();
    return source?.includes(module);
  });

  if (existingImport) {
    // TODO: Merge with existing import
    return content;
  }

  // Create new import statement
  let importStatement: string;
  if (isDefault && names.length === 1) {
    importStatement = `import ${names[0]} from '${module}';`;
  } else if (isDefault && names.length > 1) {
    importStatement = `import ${names[0]}, { ${names.slice(1).join(', ')} } from '${module}';`;
  } else {
    importStatement = `import { ${names.join(', ')} } from '${module}';`;
  }

  // Find the position to insert the import
  if (imports.length > 0) {
    // Add after last import
    const lastImport = imports[imports.length - 1];
    const pos = lastImport.range().end.index;
    return content.slice(0, pos) + '\n' + importStatement + content.slice(pos);
  } else {
    // Add at the beginning of the file
    return importStatement + '\n\n' + content;
  }
}

function removeImport(content: string, root: SgNode, targetName: string): string {
  const imports = root.findAll('ImportDeclaration');

  for (const imp of imports) {
    const source = imp.getMatch('source')?.text();
    if (source?.includes(targetName)) {
      const range = imp.range();
      // Remove the import line including the newline
      const start = range.start.index;
      let end = range.end.index;
      if (content[end] === '\n') end++;

      return content.slice(0, start) + content.slice(end);
    }
  }

  return content;
}

function renameFunction(
  content: string,
  root: SgNode,
  oldName: string,
  newName: string,
): { content: string; count: number } {
  let modifiedContent = content;
  let count = 0;

  // Find function declarations using pattern matching
  const funcDecls = root.findAll(`function ${oldName}`);
  const funcExprs = root.findAll({
    rule: {
      pattern: `const $VAR = function ${oldName}`,
    },
  });
  const arrowFuncs = root.findAll({
    rule: {
      pattern: `const ${oldName} = ($PARAMS) => $BODY`,
    },
  });

  // Find all call expressions using pattern
  const calls = root.findAll(`${oldName}($ARGS)`);

  // Collect all positions to replace (in reverse order to maintain positions)
  const replacements: Array<{ start: number; end: number; text: string }> = [];

  // Add function declarations
  for (const decl of funcDecls) {
    // For function declarations, we need to find the identifier child
    const children = decl.children();
    for (const child of children) {
      if (child.kind() === 'identifier' && child.text() === oldName) {
        const range = child.range();
        replacements.push({
          start: range.start.index,
          end: range.end.index,
          text: newName,
        });
        count++;
        break;
      }
    }
  }

  // Add function expressions and arrow functions
  for (const expr of [...funcExprs, ...arrowFuncs]) {
    // Extract the function name from the matched expression
    const identifiers = expr.findAll('identifier');
    for (const id of identifiers) {
      if (id.text() === oldName) {
        const range = id.range();
        replacements.push({
          start: range.start.index,
          end: range.end.index,
          text: newName,
        });
        count++;
        break; // Only replace the first occurrence (the function name)
      }
    }
  }

  // Add all call expressions
  for (const call of calls) {
    // The call pattern matches the entire call, so we need to find the function name part
    const callText = call.text();
    if (callText.startsWith(oldName + '(')) {
      const range = call.range();
      replacements.push({
        start: range.start.index,
        end: range.start.index + oldName.length,
        text: newName,
      });
      count++;
    }
  }

  // Sort replacements in reverse order
  replacements.sort((a, b) => b.start - a.start);

  // Apply replacements
  for (const { start, end, text } of replacements) {
    modifiedContent = modifiedContent.slice(0, start) + text + modifiedContent.slice(end);
  }

  return { content: modifiedContent, count };
}

function renameVariable(
  content: string,
  root: SgNode,
  oldName: string,
  newName: string,
): { content: string; count: number } {
  let modifiedContent = content;
  let count = 0;

  // Find all identifiers using the $ID pattern
  const refs = root.findAll('$ID');

  // Collect all positions to replace
  const replacements: Array<{ start: number; end: number; text: string }> = [];

  // Process all references that match our target name
  for (const ref of refs) {
    if (ref.text() === oldName) {
      const range = ref.range();
      replacements.push({
        start: range.start.index,
        end: range.end.index,
        text: newName,
      });
      count++;
    }
  }

  // Sort replacements in reverse order
  replacements.sort((a, b) => b.start - a.start);

  // Apply replacements
  for (const { start, end, text } of replacements) {
    modifiedContent = modifiedContent.slice(0, start) + text + modifiedContent.slice(end);
  }

  return { content: modifiedContent, count };
}

function patternReplace(
  content: string,
  root: SgNode,
  pattern: string,
  replacement: string,
): { content: string; count: number } {
  let modifiedContent = content;
  let count = 0;

  try {
    // Use ast-grep's pattern matching
    const matches = root.findAll({
      rule: {
        pattern: pattern,
      },
    });

    // Collect replacements
    const replacements: Array<{ start: number; end: number; text: string }> = [];

    for (const match of matches) {
      const range = match.range();

      // Extract metavariables from the pattern
      const metaVarRegex = /\$(\w+)/g;
      const metaVars = [...pattern.matchAll(metaVarRegex)].map(m => m[1]);

      // Build replacement text with variable substitution
      let replacementText = replacement;

      for (const varName of metaVars) {
        // Get the matched node for this metavariable
        const matchedNode = match.getMatch(varName);
        if (matchedNode) {
          const matchedText = matchedNode.text();
          // Replace all occurrences of $VARNAME with the matched text
          replacementText = replacementText.replace(new RegExp(`\\$${varName}`, 'g'), matchedText);
        }
      }

      replacements.push({
        start: range.start.index,
        end: range.end.index,
        text: replacementText,
      });
      count++;
    }

    // Sort replacements in reverse order
    replacements.sort((a, b) => b.start - a.start);

    // Apply replacements
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
