import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { HarnessRequestContext } from '@mastra/core/harness';
import type { RequestContext } from '@mastra/core/request-context';
import { Workspace, LocalFilesystem, LocalSandbox } from '@mastra/core/workspace';
import type { stateSchema } from '../schema';

// =============================================================================
// Create Workspace with Skills
// =============================================================================

// We support multiple skill locations for compatibility:
// 1. Project-local: .mastracode/skills (project-specific mastracode skills)
// 2. Project-local: .claude/skills (Claude Code compatible skills)
// 3. Global: ~/.mastracode/skills (user-wide mastracode skills)
// 4. Global: ~/.claude/skills (user-wide Claude Code skills)

const mastraCodeLocalSkillsPath = path.join(process.cwd(), '.mastracode', 'skills');

const claudeLocalSkillsPath = path.join(process.cwd(), '.claude', 'skills');

const mastraCodeGlobalSkillsPath = path.join(os.homedir(), '.mastracode', 'skills');

const claudeGlobalSkillsPath = path.join(os.homedir(), '.claude', 'skills');

// Mastra's LocalSkillSource.readdir uses Node's Dirent.isDirectory() which
// returns false for symlinks. Tools like `npx skills add` install skills as
// symlinks, so we need to resolve them. For each symlinked skill directory,
// we add the real (resolved) parent path as an additional skill scan path.
function collectSkillPaths(skillsDirs: string[]): string[] {
  const paths: string[] = [];
  const seen = new Set<string>();

  for (const skillsDir of skillsDirs) {
    if (!fs.existsSync(skillsDir)) continue;

    // Always add the directory itself
    const resolved = fs.realpathSync(skillsDir);
    if (!seen.has(resolved)) {
      seen.add(resolved);
      paths.push(skillsDir);
    }

    // Check for symlinked skill subdirectories and add their real parents
    try {
      const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isSymbolicLink()) {
          const linkPath = path.join(skillsDir, entry.name);
          const realPath = fs.realpathSync(linkPath);
          const stat = fs.statSync(realPath);
          if (stat.isDirectory()) {
            // Add the real parent directory as a skill path
            // so Mastra discovers it as a regular directory
            const realParent = path.dirname(realPath);
            if (!seen.has(realParent)) {
              seen.add(realParent);
              paths.push(realParent);
            }
          }
        }
      }
    } catch {
      // Ignore errors during symlink resolution
    }
  }

  return paths;
}

const skillPaths = collectSkillPaths([
  mastraCodeLocalSkillsPath,
  claudeLocalSkillsPath,
  mastraCodeGlobalSkillsPath,
  claudeGlobalSkillsPath,
]);

export function getDynamicWorkspace({ requestContext }: { requestContext: RequestContext }) {
  const ctx = requestContext.get('harness') as HarnessRequestContext<typeof stateSchema> | undefined;
  const state = ctx?.getState?.();
  const projectPath = state?.projectPath;

  if (!projectPath) {
    throw new Error('Project path is required');
  }

  // Sync filesystem's allowedPaths with sandbox-granted paths from harness state
  const sandboxPaths = state?.sandboxAllowedPaths ?? [];

  const workspace = new Workspace({
    id: 'mastra-code-workspace',
    name: 'Mastra Code Workspace',
    filesystem: new LocalFilesystem({
      basePath: projectPath,
      allowedPaths: skillPaths,
    }),
    sandbox: new LocalSandbox({
      workingDirectory: projectPath,
      env: process.env,
    }),
    // Disable workspace tools — built-in tools are used instead.
    // Workspace tools use different output formats (e.g. → separator, offset/limit params)
    // that the TUI renderers don't fully support yet.
    // We will update to use workspace tools very soon - just disabling until then
    tools: { enabled: false },
    ...(skillPaths.length > 0 ? { skills: skillPaths } : {}),
  });

  workspace.filesystem.setAllowedPaths([...skillPaths, ...sandboxPaths.map((p: string) => path.resolve(p))]);

  return workspace;
}

if (skillPaths.length > 0) {
  console.info(`Skills loaded from:`);
  for (const p of skillPaths) {
    console.info(`  - ${p}`);
  }
}
