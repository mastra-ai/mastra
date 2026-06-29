import { readFile } from 'node:fs/promises';
import type { DiscoveredFsAgent } from './discover';

function sanitizeIdentifier(name: string, prefix: string, index: number): string {
  const cleaned = name.replace(/[^a-zA-Z0-9_$]/g, '_');
  return `${prefix}_${index}_${cleaned}`;
}

/**
 * Generate the source of a wrapper module that:
 * 1. imports the user's real Mastra entry,
 * 2. imports each discovered `config.ts`, `tools/*.ts`, and `skills/*.ts`
 *    (`createSkill(...)` modules), inlining packaged `SKILL.md` skills,
 * 3. assembles `Agent` instances via `assembleAgentFromFsEntry`,
 * 4. registers them onto the user's `mastra` instance (code-registered agents
 *    win on name collisions), and
 * 5. re-exports everything from the user's entry so this module is a drop-in
 *    replacement for the original `#mastra` target.
 *
 * `instructions.md` contents are inlined at codegen time so no markdown loader
 * plugin is required in the bundler graph.
 *
 * @param userEntry slash-normalized absolute path to the user's mastra entry.
 * @param agents discovered fs-routed agents (absolute, slash-normalized paths).
 */
export async function generateFsAgentsModule(userEntry: string, agents: DiscoveredFsAgent[]): Promise<string> {
  const lines: string[] = [];

  const hasInlineSkills = agents.some(a => (a.skills ?? []).some(s => s.kind === 'packaged'));

  lines.push(`import { assembleAgentFromFsEntry } from '@mastra/core/agent';`);
  if (hasInlineSkills) {
    lines.push(`import { createSkill as __createSkill } from '@mastra/core/skills';`);
  }
  lines.push(`import { fileURLToPath as __fileURLToPath } from 'node:url';`);
  lines.push(`import { dirname as __dirname, join as __join } from 'node:path';`);
  lines.push(`import * as __userEntry from ${JSON.stringify(userEntry)};`);
  lines.push(`export * from ${JSON.stringify(userEntry)};`);
  lines.push(``);
  // Resolve workspace base paths relative to this bundled module so they point
  // at `<bundle>/workspace/<name>` wherever the bundle is deployed. Seed files
  // authored under `agents/<name>/workspace/**` are mirrored there at build time.
  lines.push(`const __bundleDir = __dirname(__fileURLToPath(import.meta.url));`);
  lines.push(`const __workspaceBasePath = name => __join(__bundleDir, 'workspace', name);`);
  lines.push(``);

  const entryExprs: string[] = [];

  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i]!;
    const configIdent = sanitizeIdentifier(agent.name, 'config', i);
    const toolIdents: { key: string; ident: string }[] = [];

    if (agent.configPath) {
      lines.push(`import ${configIdent} from ${JSON.stringify(agent.configPath)};`);
    }

    let workspaceIdent: string | undefined;
    if (agent.workspacePath) {
      workspaceIdent = sanitizeIdentifier(`${agent.name}_workspace`, 'workspace', i);
      lines.push(`import ${workspaceIdent} from ${JSON.stringify(agent.workspacePath)};`);
    }

    for (let t = 0; t < agent.tools.length; t++) {
      const tool = agent.tools[t]!;
      const ident = sanitizeIdentifier(`${agent.name}_${tool.key}`, 'tool', t);
      lines.push(`import ${ident} from ${JSON.stringify(tool.path)};`);
      toolIdents.push({ key: tool.key, ident });
    }

    // Skills: `createSkill(...)` modules are imported and used directly;
    // packaged `SKILL.md` skills are inlined via `createSkill({...})`.
    const skillExprs: string[] = [];
    const agentSkills = agent.skills ?? [];
    for (let s = 0; s < agentSkills.length; s++) {
      const skill = agentSkills[s]!;
      if (skill.kind === 'module') {
        const ident = sanitizeIdentifier(`${agent.name}_skill`, 'skill', s);
        lines.push(`import ${ident} from ${JSON.stringify(skill.path)};`);
        skillExprs.push(ident);
      } else {
        const referenceFields = Object.entries(skill.references).map(
          ([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)}`,
        );
        const skillFields = [
          `name: ${JSON.stringify(skill.name)}`,
          `description: ${JSON.stringify(skill.description)}`,
          `instructions: ${JSON.stringify(skill.instructions)}`,
        ];
        if (referenceFields.length > 0) {
          skillFields.push(`references: { ${referenceFields.join(', ')} }`);
        }
        skillExprs.push(`__createSkill({ ${skillFields.join(', ')} })`);
      }
    }

    let instructionsMd: string | undefined;
    if (agent.instructionsPath) {
      instructionsMd = await readFile(agent.instructionsPath, 'utf-8');
    }

    const entryFields: string[] = [`name: ${JSON.stringify(agent.name)}`];
    if (agent.configPath) {
      entryFields.push(`config: ${configIdent}`);
    }
    if (instructionsMd !== undefined) {
      entryFields.push(`instructionsMd: ${JSON.stringify(instructionsMd)}`);
    }
    if (toolIdents.length > 0) {
      const toolEntries = toolIdents.map(({ key, ident }) => `{ key: ${JSON.stringify(key)}, tool: ${ident} }`);
      entryFields.push(`tools: [${toolEntries.join(', ')}]`);
    }
    if (skillExprs.length > 0) {
      entryFields.push(`skills: [${skillExprs.join(', ')}]`);
    }
    if (workspaceIdent) {
      entryFields.push(`workspace: ${workspaceIdent}`);
    }
    // Default-on parity: every FS agent gets a default workspace (file + shell
    // tools) rooted at a per-agent `workspace/` dir next to the bundle, unless
    // config.ts or workspace.ts supplies one. Assembly applies the explicit >
    // convention > default precedence.
    entryFields.push(`defaultWorkspaceBasePath: __workspaceBasePath(${JSON.stringify(agent.name)})`);

    entryExprs.push(`{ ${entryFields.join(', ')} }`);
  }

  lines.push(``);
  lines.push(`const __fsAgentEntries = [`);
  for (const expr of entryExprs) {
    lines.push(`  ${expr},`);
  }
  lines.push(`];`);
  lines.push(``);
  lines.push(`const __fsAgents = {};`);
  lines.push(`for (const __entry of __fsAgentEntries) {`);
  lines.push(`  __fsAgents[__entry.name] = assembleAgentFromFsEntry(__entry, {`);
  lines.push(`    onWarn: msg => __userEntry.mastra?.getLogger?.()?.warn?.(msg) ?? console.warn(msg),`);
  lines.push(`  });`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`if (__userEntry.mastra && typeof __userEntry.mastra.__registerFsAgents === 'function') {`);
  lines.push(`  __userEntry.mastra.__registerFsAgents(__fsAgents);`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`export const mastra = __userEntry.mastra;`);

  return lines.join('\n');
}
