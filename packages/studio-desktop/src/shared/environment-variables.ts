export interface EnvironmentVariableRow {
  key: string;
  value: string;
}

export const ENVIRONMENT_VARIABLE_PRESETS = [
  {
    key: 'OPENAI_API_KEY',
    label: 'OpenAI key',
    value: '',
  },
  {
    key: 'LM_API_TOKEN',
    label: 'LM Studio token',
    value: '',
  },
] as const;

export function normalizeEnvironmentVariables(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }

  const variables: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(value)) {
    const key = rawKey.trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    variables[key] = typeof rawValue === 'string' ? rawValue : String(rawValue);
  }
  return variables;
}

export function rowsFromEnvironmentVariables(envVars: Record<string, unknown> | undefined): EnvironmentVariableRow[] {
  const variables = normalizeEnvironmentVariables(envVars);
  const entries = Object.entries(variables);
  return entries.length > 0 ? entries.map(([key, value]) => ({ key, value })) : [{ key: '', value: '' }];
}

export function collectEnvironmentVariables(rows: readonly EnvironmentVariableRow[]): Record<string, string> {
  const variables: Record<string, string> = {};
  const seen = new Set<string>();

  for (const row of rows) {
    const key = row.key.trim();
    if (!key) continue;
    if (seen.has(key)) {
      throw new Error(`Environment variable "${key}" is duplicated.`);
    }
    seen.add(key);
    variables[key] = row.value;
  }

  return normalizeEnvironmentVariables(variables);
}
