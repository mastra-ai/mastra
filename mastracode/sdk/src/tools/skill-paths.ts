import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isPathWithinRoot } from '../utils/path-security.js';

function collectSkillPaths(skillsDirs: string[], allowedRoot?: string): string[] {
  const paths: string[] = [];
  const seen = new Set<string>();
  let realAllowedRoot: string | undefined;

  if (allowedRoot) {
    try {
      realAllowedRoot = fs.realpathSync(allowedRoot);
    } catch {
      return [];
    }
  }

  for (const skillsDir of skillsDirs) {
    const skillsDirExists = fs.existsSync(skillsDir);
    if (skillsDirExists && realAllowedRoot) {
      try {
        const realSkillsDir = fs.realpathSync(skillsDir);
        if (!isPathWithinRoot(realSkillsDir, realAllowedRoot)) continue;
      } catch {
        continue;
      }
    }

    const resolved = path.resolve(skillsDir);
    if (!seen.has(resolved)) {
      seen.add(resolved);
      paths.push(skillsDir);
    }

    if (!skillsDirExists) continue;

    try {
      const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isSymbolicLink()) {
          try {
            const linkPath = path.join(skillsDir, entry.name);
            const realPath = fs.realpathSync(linkPath);
            if (realAllowedRoot && !isPathWithinRoot(realPath, realAllowedRoot)) continue;
            const stat = fs.statSync(realPath);
            if (stat.isDirectory()) {
              const realParent = path.dirname(realPath);
              if (realAllowedRoot && !isPathWithinRoot(realParent, realAllowedRoot)) continue;
              if (!seen.has(realParent)) {
                seen.add(realParent);
                paths.push(realParent);
              }
            }
          } catch {
            continue;
          }
        }
      }
    } catch {
      // Ignore errors during symlink resolution.
    }
  }

  return paths;
}

export function buildSkillPaths(
  projectPath: string,
  configDir: string,
  homeDir = os.homedir(),
  pluginSkillPaths: string[] = [],
): string[] {
  const mastraCodeLocalSkillsPath = path.join(projectPath, configDir, 'skills');
  const claudeLocalSkillsPath = path.join(projectPath, '.claude', 'skills');
  const agentSkillsLocalPath = path.join(projectPath, '.agents', 'skills');
  const mastraCodeGlobalSkillsPath = path.join(homeDir, configDir, 'skills');
  const claudeGlobalSkillsPath = path.join(homeDir, '.claude', 'skills');
  const agentSkillsGlobalPath = path.join(homeDir, '.agents', 'skills');

  const paths = [
    ...collectSkillPaths([mastraCodeLocalSkillsPath, claudeLocalSkillsPath, agentSkillsLocalPath], projectPath),
    ...collectSkillPaths([mastraCodeGlobalSkillsPath, claudeGlobalSkillsPath, agentSkillsGlobalPath]),
    ...pluginSkillPaths.flatMap(pluginSkillPath => collectSkillPaths([pluginSkillPath], pluginSkillPath)),
  ];

  const seenPaths = new Set<string>();
  return paths.filter(skillPath => {
    let resolved: string;
    try {
      resolved = fs.realpathSync(skillPath);
    } catch {
      resolved = path.resolve(skillPath);
    }
    if (seenPaths.has(resolved)) return false;
    seenPaths.add(resolved);
    return true;
  });
}
