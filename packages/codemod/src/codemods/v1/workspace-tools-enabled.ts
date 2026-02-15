import { createTransformer } from '../lib/create-transformer';

/**
 * Adds `tools: { enabled: true }` to Workspace constructor calls that don't
 * already have an explicit `enabled` setting.
 *
 * Workspace tools were previously enabled by default. Now they're disabled by
 * default. This codemod preserves the old behavior for existing code.
 *
 * Skips if:
 * - Constructor already has `tools.enabled` set to any value (true or false)
 * - Constructor has no object argument
 *
 * Before:
 * const workspace = new Workspace({
 *   filesystem: new LocalFilesystem({ basePath: './data' }),
 * });
 *
 * After:
 * const workspace = new Workspace({
 *   filesystem: new LocalFilesystem({ basePath: './data' }),
 *   tools: { enabled: true },
 * });
 *
 * Already has tools.enabled — left alone:
 * const workspace = new Workspace({
 *   filesystem: new LocalFilesystem({ basePath: './data' }),
 *   tools: { enabled: false },
 * });
 */
export default createTransformer((_fileInfo, _api, _options, context) => {
  const { j, root } = context;

  root
    .find(j.NewExpression, {
      callee: { type: 'Identifier', name: 'Workspace' },
    })
    .forEach(path => {
      const args = path.value.arguments;
      const firstArg = args[0];

      // Only process if the first arg is an object literal
      if (!firstArg || firstArg.type !== 'ObjectExpression') {
        return;
      }

      // Check if there's already a `tools` property
      const toolsProp = firstArg.properties.find(
        (prop: any) =>
          prop.type === 'ObjectProperty' &&
          ((prop.key.type === 'Identifier' && prop.key.name === 'tools') ||
            (prop.key.type === 'StringLiteral' && prop.key.value === 'tools')),
      );

      if (toolsProp) {
        // tools property exists — check if it already has `enabled`
        const toolsValue = (toolsProp as any).value;
        if (toolsValue && toolsValue.type === 'ObjectExpression') {
          const hasEnabled = toolsValue.properties.some(
            (prop: any) =>
              prop.type === 'ObjectProperty' &&
              ((prop.key.type === 'Identifier' && prop.key.name === 'enabled') ||
                (prop.key.type === 'StringLiteral' && prop.key.value === 'enabled')),
          );

          if (hasEnabled) {
            // Already has enabled set — leave it alone
            return;
          }

          // Has tools but no enabled — add enabled: true
          toolsValue.properties.unshift(j.objectProperty(j.identifier('enabled'), j.booleanLiteral(true)));
          context.hasChanges = true;
        }
        // If tools value is not an object expression (e.g. a variable), leave it alone
        return;
      }

      // No tools property at all — add tools: { enabled: true }
      firstArg.properties.push(
        j.objectProperty(
          j.identifier('tools'),
          j.objectExpression([j.objectProperty(j.identifier('enabled'), j.booleanLiteral(true))]),
        ),
      );
      context.hasChanges = true;
    });

  if (context.hasChanges) {
    context.messages.push(
      'Added tools: { enabled: true } to Workspace constructor to preserve previous default behavior. ' +
        'Workspace tools are now disabled by default. ' +
        'Consider importing workspace tools directly from @mastra/core/workspace instead.',
    );
  }
});
