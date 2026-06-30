import { readFile } from 'node:fs/promises';
import type { DiscoveredFsAgent } from './discover';

function sanitizeIdentifier(name: string, prefix: string, index: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9_$]/g, '_');
  return `${prefix}_${index}_${cleaned}`;
}

/**
 * Emit the imports for a single discovered agent into `lines` and return the
 * source of its `assembleAgentFromFsEntry` entry object (the `{ name, config,
 * ... }` argument). `idPath` is a dot-free, unique path index (e.g. `0` for the
 * first top-level agent, `0_1` for its second subagent) used to keep generated
 * identifiers unique across the parent/child tree. `workspaceName` is the
 * slash-joined workspace key (`<parent>/<child>` for subagents) so seed files
 * don't collide. When `allowSubagents` is true the agent's discovered subagents
 * are emitted as a nested `subagents: [...]` field.
 */
async function emitAgentEntry(
  agent: DiscoveredFsAgent,
  idPath: string,
  workspaceName: string,
  allowSubagents: boolean,
  lines: string[],
): Promise<string> {
  const configIdent = sanitizeIdentifier(agent.name, 'config', idPath);
  const toolIdents: { key: string; ident: string }[] = [];

  if (agent.configPath) {
    lines.push(`import ${configIdent} from ${JSON.stringify(agent.configPath)};`);
  }

  let workspaceIdent: string | undefined;
  if (agent.workspacePath) {
    workspaceIdent = sanitizeIdentifier(`${agent.name}_workspace`, 'workspace', idPath);
    lines.push(`import ${workspaceIdent} from ${JSON.stringify(agent.workspacePath)};`);
  }

  let memoryIdent: string | undefined;
  if (agent.memoryPath) {
    memoryIdent = sanitizeIdentifier(`${agent.name}_memory`, 'memory', idPath);
    lines.push(`import ${memoryIdent} from ${JSON.stringify(agent.memoryPath)};`);
  }

  for (let t = 0; t < agent.tools.length; t++) {
    const tool = agent.tools[t]!;
    const ident = sanitizeIdentifier(`${agent.name}_${tool.key}`, 'tool', `${idPath}_${t}`);
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
      const ident = sanitizeIdentifier(`${agent.name}_skill`, 'skill', `${idPath}_${s}`);
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

  // Declared subagents (one level deep). Each is itself an
  // `assembleAgentFromFsEntry` entry object with no further `subagents`.
  const subagentExprs: string[] = [];
  if (allowSubagents) {
    for (let c = 0; c < agent.subagents.length; c++) {
      const child = agent.subagents[c]!;
      const childExpr = await emitAgentEntry(child, `${idPath}_${c}`, `${workspaceName}/${child.name}`, false, lines);
      subagentExprs.push(childExpr);
    }
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
  if (subagentExprs.length > 0) {
    entryFields.push(`subagents: [${subagentExprs.join(', ')}]`);
  }
  if (workspaceIdent) {
    entryFields.push(`workspace: ${workspaceIdent}`);
  }
  if (memoryIdent) {
    entryFields.push(`memory: ${memoryIdent}`);
  }
  // Default-on parity: every FS agent gets a default workspace (file + shell
  // tools) rooted at a per-agent `workspace/` dir next to the bundle, unless
  // config.ts or workspace.ts supplies one. Assembly applies the explicit >
  // convention > default precedence. Subagents nest under `<parent>/<child>` so
  // their seed directories never collide with the parent's.
  entryFields.push(`defaultWorkspaceBasePath: __workspaceBasePath(${JSON.stringify(workspaceName)})`);

  return `{ ${entryFields.join(', ')} }`;
}

/**
 * Generate the source of a wrapper module that:
 * 1. imports the user's real Mastra entry,
 * 2. imports each discovered `config.ts`, `tools/*.ts`, `skills/*.ts`
 *    (`createSkill(...)` modules), `workspace.ts`, and `memory.ts`, inlining
 *    packaged `SKILL.md` skills,
 * 3. assembles `Agent` instances via `assembleAgentFromFsEntry`, wiring any
 *    declared `subagents/` into the parent (one level deep),
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

  const hasInlineSkills = agents.some(a =>
    [a, ...(a.subagents ?? [])].some(x => (x.skills ?? []).some(s => s.kind === 'packaged')),
  );

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
  // `name` may be a slash-joined path (`<parent>/<child>`) for subagents.
  lines.push(`const __bundleDir = __dirname(__fileURLToPath(import.meta.url));`);
  lines.push(`const __workspaceBasePath = name => __join(__bundleDir, 'workspace', ...name.split('/'));`);
  lines.push(``);

  const entryExprs: string[] = [];
  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i]!;
    const expr = await emitAgentEntry(agent, `${i}`, agent.name, true, lines);
    entryExprs.push(expr);
  }

  lines.push(``);
  lines.push(`const __fsAgentEntries = [`);
  for (const expr of entryExprs) {
    lines.push(`  ${expr},`);
  }
  lines.push(`];`);
  lines.push(``);
  lines.push(`const __fsAgents = Object.create(null);`);
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
