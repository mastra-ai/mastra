import { z } from 'zod';

type PromptValue = string | number | boolean | null;

export type PromptFactInput = Readonly<{
  semanticKey: string;
  factType: string;
  value: PromptValue;
  sensitivity: 'public' | 'internal' | 'confidential' | 'restricted';
}>;

const promptToken = (prefix: 'fact' | 'type' | 'value') =>
  z.string().regex(new RegExp(`^${prefix}-(?:[1-9]|[1-4][0-9])$`, 'u'));

export const PromptSafeFactSchema = z
  .object({
    factToken: promptToken('fact'),
    factTypeToken: promptToken('type'),
    valueToken: promptToken('value'),
    valueType: z.enum(['string', 'number', 'boolean', 'null']),
    sensitivity: z.enum(['public', 'internal', 'confidential', 'restricted']),
  })
  .strict();

export type PromptSafeFact = z.infer<typeof PromptSafeFactSchema>;

/**
 * Projects every provider-controlled string into invocation-local opaque
 * tokens. Equality groups remain visible, while no raw key, type, value, ID,
 * hash, timestamp, or instruction can become prompt syntax.
 */
export function projectFactsForPrompt(facts: readonly PromptFactInput[]): PromptSafeFact[] {
  const typeTokens = new Map<string, string>();
  const valueTokens = new Map<string, string>();
  return PromptSafeFactSchema.array()
    .max(48)
    .parse(
      facts.map((fact, index) => ({
        factToken: `fact-${index + 1}`,
        factTypeToken: opaqueGroupToken(typeTokens, fact.factType, 'type'),
        valueToken: opaqueGroupToken(valueTokens, valueKey(fact.value), 'value'),
        valueType: promptValueType(fact.value),
        sensitivity: fact.sensitivity,
      })),
    );
}

function opaqueGroupToken(tokens: Map<string, string>, rawKey: string, prefix: 'type' | 'value'): string {
  let token = tokens.get(rawKey);
  if (!token) {
    token = `${prefix}-${tokens.size + 1}`;
    tokens.set(rawKey, token);
  }
  return token;
}

function valueKey(value: PromptValue): string {
  if (value === null) return 'null';
  return `${typeof value}:${JSON.stringify(value)}`;
}

function promptValueType(value: PromptValue): PromptSafeFact['valueType'] {
  if (value === null) return 'null';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  return 'boolean';
}
