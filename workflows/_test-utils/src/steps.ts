/** A run result's steps. A storage v2 result's `steps` is a loader, so this awaits it. */
export async function stepsOf(result: { steps: unknown }): Promise<Record<string, any>> {
  return typeof result.steps === 'function' ? await result.steps() : (result.steps as Record<string, any>);
}
