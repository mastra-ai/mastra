import { createAttioInputProvider } from '../providers/attio/input';
import type { InputFactory } from '../providers/input';
import { LocalInputProvider } from '../providers/local/input';

export const inputProviders = new Map<string, InputFactory>([
  ['local', context => new LocalInputProvider(context.config.source)],
  ['attio', createAttioInputProvider],
]);

export function inputProvider(environment: NodeJS.ProcessEnv = process.env): InputFactory {
  const id = environment.LEAD_INPUT_PROVIDER || 'local';
  const factory = inputProviders.get(id);
  if (!factory) throw new Error(`Unknown input provider: ${id}`);
  return factory;
}
