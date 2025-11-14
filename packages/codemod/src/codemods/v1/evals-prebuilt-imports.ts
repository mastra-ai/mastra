import { createTransformer } from '../lib/create-transformer';

/**
 * Updates prebuilt scorer imports to use the consolidated scorers/prebuilt path.
 * Replaces both scorers/llm and scorers/code with scorers/prebuilt.
 *
 * Before:
 * import { createHallucinationScorer } from '@mastra/evals/scorers/llm';
 * import { createContentSimilarityScorer } from '@mastra/evals/scorers/code';
 *
 * After:
 * import { createHallucinationScorer } from '@mastra/evals/scorers/prebuilt';
 * import { createContentSimilarityScorer } from '@mastra/evals/scorers/prebuilt';
 */
export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  const oldPaths = ['@mastra/evals/scorers/llm', '@mastra/evals/scorers/code'];
  const newPath = '@mastra/evals/scorers/prebuilt';

  // Find and update import declarations
  root.find(j.ImportDeclaration).forEach(path => {
    const source = path.value.source.value;

    // Check if this import is from one of the old paths
    if (typeof source === 'string' && oldPaths.includes(source)) {
      // Update the import path
      path.value.source.value = newPath;
      context.hasChanges = true;
    }
  });

  if (context.hasChanges) {
    context.messages.push('Updated prebuilt scorer imports from scorers/llm and scorers/code to scorers/prebuilt');
  }
});
