import { createTransformer } from '../lib/create-transformer';

/**
 * Transforms workflow run VNext methods to their standard names:
 * - run.streamVNext() → run.stream()
 * - run.resumeStreamVNext() → run.resumeStream()
 * - run.observeStreamVNext() → run.observeStream()
 *
 * These methods are called on the result of workflow.createRun().
 */
export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Map of old method names to new method names
  const methodRenames: Record<string, string> = {
    streamVNext: 'stream',
    resumeStreamVNext: 'resumeStream',
    observeStreamVNext: 'observeStream',
  };

  let count = 0;

  // Find all call expressions and rename VNext methods
  // These method names are unique enough to Mastra workflow runs
  // that we can safely rename them globally
  root.find(j.CallExpression).forEach(path => {
    const { callee } = path.value;
    if (callee.type !== 'MemberExpression') return;
    if (callee.property.type !== 'Identifier') return;

    const oldName = callee.property.name;
    if (!Object.hasOwn(methodRenames, oldName)) return;

    const newName = methodRenames[oldName];
    if (newName) {
      callee.property.name = newName;
      count++;
    }
  });

  if (count > 0) {
    context.hasChanges = true;
    context.messages.push(
      `Renamed workflow run VNext methods: streamVNext/resumeStreamVNext/observeStreamVNext → stream/resumeStream/observeStream`,
    );
  }
});
