import { createTransformer } from '../lib/create-transformer';

/**
 * Converts PgVector constructor from positional string argument to object parameter.
 * This provides a more consistent API across all storage adapters.
 *
 * Before:
 * const pgVector = new PgVector(process.env.POSTGRES_CONNECTION_STRING!);
 *
 * After:
 * const pgVector = new PgVector({
 *   connectionString: process.env.POSTGRES_CONNECTION_STRING
 * });
 */
export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  root
    .find(j.NewExpression, {
      callee: { type: 'Identifier', name: 'PgVector' },
    })
    .forEach(path => {
      const args = path.value.arguments;
      const firstArg = args[0];

      if (args.length === 1 && firstArg && firstArg.type !== 'ObjectExpression') {
        path.value.arguments = [
          j.objectExpression([j.objectProperty(j.identifier('connectionString'), firstArg as any)]),
        ];

        context.hasChanges = true;
      }
    });

  if (context.hasChanges) {
    context.messages.push('Converted PgVector constructor from positional to object parameter');
  }
});
