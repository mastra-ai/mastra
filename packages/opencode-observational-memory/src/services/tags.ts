import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { CONFIG } from '../config.js';

/**
 * Get the git user email, or a fallback value
 */
function getGitUserEmail(): string {
  try {
    const email = execSync('git config user.email', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return email || 'unknown-user';
  } catch {
    return 'unknown-user';
  }
}

/**
 * Create a SHA256 hash of a string
 */
function hashString(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 16);
}

export interface Tags {
  /** User tag for cross-project memories */
  user: string;
  /** Project tag for project-specific memories */
  project: string;
  /** Resource ID for Mastra memory */
  resourceId: string;
}

/**
 * Get container tags for the current context
 */
export function getTags(directory: string): Tags {
  const prefix = CONFIG.containerTagPrefix;
  const userEmail = getGitUserEmail();
  const userHash = hashString(userEmail);
  const projectHash = hashString(directory);

  // Resource ID is derived from git email for consistency
  const resourceId = `${prefix}_user_${userHash}`;

  return {
    user: `${prefix}_user_${userHash}`,
    project: `${prefix}_project_${projectHash}`,
    resourceId,
  };
}
