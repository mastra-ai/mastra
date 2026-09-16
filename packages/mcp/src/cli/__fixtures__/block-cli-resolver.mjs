export function resolve(specifier, context, next) {
  if (/^(tsx|json-schema-to-typescript)(\/|$)/.test(specifier))
    throw new Error(`Unexpected CLI dependency: ${specifier}`);
  return next(specifier, context);
}
