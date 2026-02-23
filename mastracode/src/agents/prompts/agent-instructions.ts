/**
 * Load project and global agent instruction files (AGENTS.md, CLAUDE.md).
 * Prefers AGENTS.md over CLAUDE.md when multiple exist at the same location.
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// Filenames to check, in order of preference
const INSTRUCTION_FILES = ['AGENTS.md', 'CLAUDE.md'];

// Locations to scan (relative to project root or home)
const PROJECT_LOCATIONS = [
  '', // project root
  '.claude',
  '.mastracode',
];

const GLOBAL_LOCATIONS = ['.claude', '.mastracode', '.config/claude', '.config/mastracode'];

interface InstructionSource {
  path: string;
  content: string;
  scope: 'global' | 'project';
}

/**
 * Find the first existing instruction file at a given base path.
 * Prefers AGENTS.md over CLAUDE.md.
 */
function findInstructionFile(basePath: string): string | null {
  for (const filename of INSTRUCTION_FILES) {
    const fullPath = join(basePath, filename);
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }
  return null;
}

/**
 * Load all agent instruction files from global and project locations.
 * Returns an array of instruction sources, with global ones first.
 */
export function loadAgentInstructions(projectPath: string): InstructionSource[] {
  const sources: InstructionSource[] = [];
  const home = homedir();

  // Load global instructions first
  for (const location of GLOBAL_LOCATIONS) {
    const basePath = join(home, location);
    const filePath = findInstructionFile(basePath);
    if (filePath) {
      try {
        const content = readFileSync(filePath, 'utf-8').trim();
        if (content) {
          sources.push({ path: filePath, content, scope: 'global' });
          break; // Only use first found global instruction file
        }
      } catch {
        // Skip unreadable files
      }
    }
  }

  // Load project instructions
  for (const location of PROJECT_LOCATIONS) {
    const basePath = location ? join(projectPath, location) : projectPath;
    const filePath = findInstructionFile(basePath);
    if (filePath) {
      try {
        const content = readFileSync(filePath, 'utf-8').trim();
        if (content) {
          sources.push({ path: filePath, content, scope: 'project' });
          break; // Only use first found project instruction file
        }
      } catch {
        // Skip unreadable files
      }
    }
  }

  return sources;
}

/**
 * Format loaded instructions into a string for the system prompt.
 */
export function formatAgentInstructions(sources: InstructionSource[]): string {
  if (sources.length === 0) return '';

  const sections = sources.map(source => {
    const label = source.scope === 'global' ? 'Global' : 'Project';
    return `<!-- ${label} instructions from ${source.path} -->\n${source.content}`;
  });

  return `\n# Agent Instructions\n\n${sections.join('\n\n')}\n`;
}
