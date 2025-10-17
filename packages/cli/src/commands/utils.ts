import { InvalidArgumentError } from 'commander';
import type { PackageManager } from '../utils/package-manager';
import { EDITOR, isValidEditor } from './init/mcp-docs-server-install';
import { areValidComponents, COMPONENTS, isValidLLMProvider, LLMProvider } from './init/utils';

export function getPackageManager(): PackageManager {
  const userAgent = process.env.npm_config_user_agent || '';
  const execPath = process.env.npm_execpath || '';

  // Check user agent first
  if (userAgent.includes('yarn')) {
    return 'yarn';
  }
  if (userAgent.includes('pnpm')) {
    return 'pnpm';
  }
  if (userAgent.includes('npm')) {
    return 'npm';
  }

  // Fallback to execpath check
  if (execPath.includes('yarn')) {
    return 'yarn';
  }
  if (execPath.includes('pnpm')) {
    return 'pnpm';
  }
  if (execPath.includes('npm')) {
    return 'npm';
  }

  return 'npm'; // Default fallback
}

export function parseMcp(value: string) {
  if (!isValidEditor(value)) {
    throw new InvalidArgumentError(`Choose a valid value: ${EDITOR.join(', ')}`);
  }
  return value;
}

export function parseComponents(value: string) {
  const parsedValue = value.split(',');

  if (!areValidComponents(parsedValue)) {
    throw new InvalidArgumentError(`Choose valid components: ${COMPONENTS.join(', ')}`);
  }

  return parsedValue;
}

export function parseLlmProvider(value: string) {
  if (!isValidLLMProvider(value)) {
    throw new InvalidArgumentError(`Choose a valid provider: ${LLMProvider.join(', ')}`);
  }
  return value;
}
