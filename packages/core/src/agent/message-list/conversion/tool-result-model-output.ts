const explicitModelOutputs = new WeakSet<object>();

export function markExplicitModelOutput(output: unknown): void {
  if (output && typeof output === 'object') {
    explicitModelOutputs.add(output);
  }
}

export function hasExplicitModelOutput(output: unknown): boolean {
  return Boolean(output && typeof output === 'object' && explicitModelOutputs.has(output));
}

export function transferExplicitModelOutput(source: unknown, target: unknown): void {
  if (hasExplicitModelOutput(source)) {
    markExplicitModelOutput(target);
  }
}
