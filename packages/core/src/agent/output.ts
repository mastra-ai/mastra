export function successfulAgentOutput<T extends { error?: unknown }>(output: T): T {
  if (output.error) {
    throw output.error;
  }
  return output;
}

export async function drainAgentOutput<T extends { error?: unknown }>(output: {
  getFullOutput(): Promise<T>;
}): Promise<T> {
  return successfulAgentOutput(await output.getFullOutput());
}
