import { createAttioOutputProvider } from '../providers/attio/output';
import { LocalOutputProvider } from '../providers/local/output';
import type { OutputFactory } from '../providers/output';

export const outputProviders = new Map<string, OutputFactory>([
  ['local', client => new LocalOutputProvider(client)],
  ['attio', () => createAttioOutputProvider()],
]);

export function outputProvider(environment: NodeJS.ProcessEnv = process.env): OutputFactory {
  const id = environment.LEAD_OUTPUT_PROVIDER || 'local';
  const factory = outputProviders.get(id);
  if (!factory) throw new Error(`Unknown output provider: ${id}`);
  return factory;
}
