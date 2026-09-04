const builderValidatedContexts = new WeakSet<object>();

export function markBuilderValidatedInput(context: object): void {
  builderValidatedContexts.add(context);
}

export function consumeBuilderValidatedInput(context: unknown): boolean {
  if (typeof context !== 'object' || context === null || !builderValidatedContexts.has(context)) {
    return false;
  }

  builderValidatedContexts.delete(context);
  return true;
}
