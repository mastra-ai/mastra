import type { ApiCommandDescriptor } from './commands.js';
import { ApiCliError } from './errors.js';

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export function parseInput(descriptor: ApiCommandDescriptor, input?: string): Record<string, unknown> | undefined {
  if (!descriptor.acceptsInput) return undefined;

  if (!input) {
    if (descriptor.inputRequired) {
      throw new ApiCliError('MISSING_INPUT', 'Command requires a single inline JSON input argument', {
        command: `mastra api ${descriptor.name}`,
      });
    }
    return undefined;
  }

  try {
    const parsed = JSON.parse(input);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new ApiCliError('INVALID_JSON', 'Input JSON must be an object');
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof ApiCliError) throw error;
    throw new ApiCliError('INVALID_JSON', 'Input must be valid JSON', {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export function resolvePathParams(
  descriptor: ApiCommandDescriptor,
  positionalValues: string[],
  input?: Record<string, unknown>,
): Record<string, string> {
  const params: Record<string, string> = {};

  descriptor.positionals.forEach((name, index) => {
    const value = positionalValues[index];
    if (!value) {
      throw new ApiCliError('MISSING_ARGUMENT', `Missing required argument <${name}>`, { argument: name });
    }
    params[name] = value;
  });

  for (const name of pathParamNames(descriptor.path)) {
    if (params[name]) continue;
    const value = input?.[name];
    if (typeof value !== 'string' || !value) {
      throw new ApiCliError('MISSING_ARGUMENT', `Missing required argument <${name}>`, { argument: name });
    }
    params[name] = value;
  }

  return params;
}

export function stripPathParamsFromInput(
  input: Record<string, unknown> | undefined,
  params: Record<string, string>,
): Record<string, unknown> | undefined {
  if (!input) return undefined;
  const copy = { ...input };
  for (const key of Object.keys(params)) delete copy[key];
  return copy;
}

function pathParamNames(path: string): string[] {
  return Array.from(path.matchAll(/:([A-Za-z0-9_]+)/g)).map(match => match[1]!);
}
