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

      // Track which imports should stay and which should be moved
      // Use an array to maintain order
      const remainingSpecifiers: any[] = [];
      const importsToMove: Array<{ subpath: string; localName: string; importedName: string }> = [];

      specifiers.forEach(specifier => {
        if (specifier.type === 'ImportSpecifier') {
          const imported = specifier.imported;
          const importedName = imported.type === 'Identifier' ? imported.name : (imported as any).value;
          const localName = specifier.local?.name || importedName;

          // Check if this import should be moved to a subpath
          const newSubpath = EXPORT_TO_SUBPATH[importedName];

          if (newSubpath) {
            // This import should be moved to a new subpath
            importsToMove.push({ subpath: newSubpath, localName, importedName });
          } else {
            // This import stays at '@mastra/core' (e.g., Mastra, Config)
            remainingSpecifiers.push(specifier);
          }
        } else {
          // Keep default imports and namespace imports as-is
          remainingSpecifiers.push(specifier);
        }
      });

      // If we have imports to move, create new import declarations
      if (importsToMove.length > 0) {
        context.hasChanges = true;

        // Group imports by subpath while maintaining order
        const groupedImports = new Map<string, Array<{ localName: string; importedName: string }>>();
        importsToMove.forEach(({ subpath, localName, importedName }) => {
          if (!groupedImports.has(subpath)) {
            groupedImports.set(subpath, []);
          }
          groupedImports.get(subpath)!.push({ localName, importedName });
        });

        // Create new import declarations for each subpath
        // We'll collect them and insert in reverse order to maintain correct ordering
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

        // Insert new imports in reverse order so they appear in correct order
        newImports.reverse().forEach(newImport => {
          j(importPath).insertAfter(newImport);
        });

        // Update or remove the original import
        if (remainingSpecifiers.length > 0) {
          // Keep the original import with only the remaining specifiers
          node.specifiers = remainingSpecifiers;
          const remainingList = remainingSpecifiers
            .filter(s => s.type === 'ImportSpecifier')
            .map(s => (s as any).imported?.name || (s as any).local?.name)
            .filter(Boolean)
            .join(', ');
          if (remainingList) {
            context.messages.push(`Kept at '@mastra/core': ${remainingList}`);
          }
        } else {
          // Remove the original import entirely
          j(importPath).remove();
          context.messages.push(`Removed original '@mastra/core' import (all imports moved to subpaths)`);
        }
      }
    });
});
