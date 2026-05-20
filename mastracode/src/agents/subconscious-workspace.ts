import os from 'node:os';
import { join } from 'node:path';

function sanitizeResourceId(resourceId: string): string {
  return resourceId.replace(/[^a-zA-Z0-9._-]/g, '_') || 'default';
}

export function getSubconsciousWorkspacePath(resourceId: string): string {
  return join(os.homedir(), '.mastracode', 'subconscious', sanitizeResourceId(resourceId));
}
