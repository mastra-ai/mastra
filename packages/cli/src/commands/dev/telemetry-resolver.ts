import type { ResolveHookContext } from 'node:module';

export async function resolve(
  specifier: string,
  context: ResolveHookContext,
  nextResolve: (specifier: string, context: ResolveHookContext) => Promise<{ url: string }>,
) {
  if (!specifier.startsWith('@opentelemetry')) {
    return nextResolve(specifier, context);
  }

  if (!context.parentURL?.endsWith('instrumentation.mjs')) {
    return nextResolve(specifier, context);
  }

  return nextResolve(specifier, {
    ...context,
    parentURL: import.meta.url,
  });
}
