import { createTransformer } from '../lib/create-transformer';

/**
 * For v1 we removed all top-level exports from "@mastra/core" except for `Mastra` and `type Config`.
 * All other imports should use subpath imports, e.g. `import { Agent } from "@mastra/core/agent"`.
 *
 * This codemod updates all imports from "@mastra/core" to use the new subpath imports. It leaves imports to `Mastra` and `Config` unchanged.
 */

// TODO: Do not hardcode this mapping, generate it from the package's exports in the future
const EXPORT_TO_SUBPATH: Record<string, string> = {
  // Agent
  Agent: '@mastra/core/agent',

  // Tools
  createTool: '@mastra/core/tools',
  Tool: '@mastra/core/tools',

  // Workflows
  createWorkflow: '@mastra/core/workflows',
  createStep: '@mastra/core/workflows',
  Workflow: '@mastra/core/workflows',
  Step: '@mastra/core/workflows',

  // Request Context
  RequestContext: '@mastra/core/request-context',

  // Processors
  BatchPartsProcessor: '@mastra/core/processors',
  PIIDetector: '@mastra/core/processors',
  ModerationProcessor: '@mastra/core/processors',
  TokenLimiterProcessor: '@mastra/core/processors',
  Processor: '@mastra/core/processors',
  UnicodeNormalizer: '@mastra/core/processors',
  SystemPromptScrubber: '@mastra/core/processors',
  PromptInjectionDetector: '@mastra/core/processors',
  LanguageDetector: '@mastra/core/processors',

  // Voice
  CompositeVoice: '@mastra/core/voice',

  // Scorers/Evals
  runExperiment: '@mastra/core/scores',
  createScorer: '@mastra/core/scores',

  // Server
  registerApiRoute: '@mastra/core/server',

  // AI Tracing
  DefaultExporter: '@mastra/core/ai-tracing',
  CloudExporter: '@mastra/core/ai-tracing',

  // Streaming
  ChunkType: '@mastra/core/stream',
  MastraMessageV2: '@mastra/core/stream',

  // LLM/Models
  ModelRouterEmbeddingModel: '@mastra/core/llm',
};

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Find all import declarations from '@mastra/core'
  root
    .find(j.ImportDeclaration, {
      source: { value: '@mastra/core' },
    })
    .forEach(importPath => {
      const node = importPath.node;
      const specifiers = node.specifiers || [];

      // Categorize specifiers into those that stay vs those that move
      const { remainingSpecifiers, importsToMove } = categorizeImports(specifiers);

      // Early return: No imports to move
      if (importsToMove.length === 0) return;

      context.hasChanges = true;

      // Group imports by their target subpath
      const groupedImports = groupImportsBySubpath(importsToMove);

      // Create new import declarations for each subpath
      const newImports = createNewImports(j, groupedImports, context);

      // Insert new imports after the current one (in reverse to maintain order)
      insertImports(j, importPath, newImports);

      // Update or remove the original import
      updateOriginalImport(j, importPath, node, remainingSpecifiers, context);
    });
});

/**
 * Categorize import specifiers into those that stay vs those that move
 */
function categorizeImports(specifiers: any[]) {
  const remainingSpecifiers: any[] = [];
  const importsToMove: Array<{ subpath: string; localName: string; importedName: string }> = [];

  specifiers.forEach(specifier => {
    // Keep default and namespace imports as-is
    if (specifier.type !== 'ImportSpecifier') {
      remainingSpecifiers.push(specifier);
      return;
    }

    const imported = specifier.imported;
    const importedName = getImportedName(imported);
    const localName = specifier.local?.name || importedName;

    // Check if this import should be moved to a subpath
    const newSubpath = EXPORT_TO_SUBPATH[importedName];

    if (newSubpath) {
      importsToMove.push({ subpath: newSubpath, localName, importedName });
    } else {
      // This import stays at '@mastra/core' (e.g., Mastra, Config)
      remainingSpecifiers.push(specifier);
    }
  });

  return { remainingSpecifiers, importsToMove };
}

/**
 * Extract the imported name from an import specifier
 */
function getImportedName(imported: any): string {
  if (imported.type === 'Identifier') {
    return imported.name;
  }
  // Handle string literal imports (edge case)
  return imported.value || '';
}

/**
 * Group imports by their target subpath
 */
function groupImportsBySubpath(importsToMove: Array<{ subpath: string; localName: string; importedName: string }>) {
  const groupedImports = new Map<string, Array<{ localName: string; importedName: string }>>();

  importsToMove.forEach(({ subpath, localName, importedName }) => {
    if (!groupedImports.has(subpath)) {
      groupedImports.set(subpath, []);
    }
    groupedImports.get(subpath)!.push({ localName, importedName });
  });

  return groupedImports;
}

/**
 * Create new import declarations for each subpath
 */
function createNewImports(
  j: any,
  groupedImports: Map<string, Array<{ localName: string; importedName: string }>>,
  context: any,
) {
  const newImports: any[] = [];

  groupedImports.forEach((imports, subpath) => {
    const newSpecifiers = imports.map(({ localName, importedName }) => {
      if (localName === importedName) {
        // import { Agent } from '@mastra/core/agent'
        return j.importSpecifier(j.identifier(importedName));
      } else {
        // import { Agent as MastraAgent } from '@mastra/core/agent'
        return j.importSpecifier(j.identifier(importedName), j.identifier(localName));
      }
    });

    const newImport = j.importDeclaration(newSpecifiers, j.stringLiteral(subpath));
    newImports.push(newImport);

    // Log which imports were moved to which subpath
    const importList = imports.map(i => i.importedName).join(', ');
    context.messages.push(`Moved imports to '${subpath}': ${importList}`);
  });

  return newImports;
}

/**
 * Insert new imports after the current import (in reverse to maintain order)
 */
function insertImports(j: any, importPath: any, newImports: any[]) {
  newImports.reverse().forEach(newImport => {
    j(importPath).insertAfter(newImport);
  });
}

/**
 * Update or remove the original import declaration
 */
function updateOriginalImport(j: any, importPath: any, node: any, remainingSpecifiers: any[], context: any) {
  if (remainingSpecifiers.length > 0) {
    // Keep the original import with only the remaining specifiers
    node.specifiers = remainingSpecifiers;

    const remainingList = extractRemainingImportNames(remainingSpecifiers);
    if (remainingList) {
      context.messages.push(`Kept at '@mastra/core': ${remainingList}`);
    }
  } else {
    // Remove the original import entirely (all imports moved)
    j(importPath).remove();
    context.messages.push(`Removed original '@mastra/core' import (all imports moved to subpaths)`);
  }
}

/**
 * Extract the names of remaining imports for logging
 */
function extractRemainingImportNames(remainingSpecifiers: any[]): string {
  return remainingSpecifiers
    .filter(s => s.type === 'ImportSpecifier')
    .map(s => s.imported?.name || s.local?.name)
    .filter(Boolean)
    .join(', ');
}
