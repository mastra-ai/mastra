import { createTransformer } from '../lib/create-transformer';

/**
 * Transforms getInitData() calls to getInitData<any>() to add explicit type parameter.
 * This ensures type safety when accessing the initial workflow data.
 *
 * Before:
 * createStep({
 *   execute: async ({ getInitData }) => {
 *     const initData = getInitData();
 *     if (initData.key === 'value') {}
 *   },
 * });
 *
 * After:
 * createStep({
 *   execute: async ({ getInitData }) => {
 *     const initData = getInitData<any>();
 *     if (initData.key === 'value') {}
 *   },
 * });
 */
export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Find all call expressions where the callee is 'getInitData'
  root
    .find(j.CallExpression, {
      callee: {
        type: 'Identifier',
        name: 'getInitData',
      },
    })
    .forEach(path => {
      const callExpr = path.value;
      // Skip if already has type arguments
      if (callExpr.typeArguments) {
        return;
      }

      // Create the type argument <any>
      const anyType = j.tsTypeReference(j.identifier('any'));
      const typeParameterInstantiation = j.tsTypeParameterInstantiation([anyType]);

      // Add type arguments to the call expression
      // @ts-expect-error - jscodeshift's type system is not compatible with the type arguments we're adding
      callExpr.typeArguments = typeParameterInstantiation;

      context.hasChanges = true;
    });

  if (context.hasChanges) {
    context.messages.push('Transformed getInitData() calls to getInitData<any>()');
  }
});
