import { readFile } from 'node:fs/promises';
import type { DiscoveredFsAgent, DiscoveredFsSingleton, DiscoveredFsWorkflow } from './discover';

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
 * don't collide. Discovered subagents are emitted recursively as a nested
 * `subagents: [...]` field (discovery already enforces the depth cap).
 */
async function emitAgentEntry(
  agent: DiscoveredFsAgent,
  idPath: string,
  workspaceName: string,
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

  const inputProcessorIdents: string[] = [];
  for (let p = 0; p < agent.inputProcessors.length; p++) {
    const proc = agent.inputProcessors[p]!;
    const ident = sanitizeIdentifier(`${agent.name}_inputProc_${proc.key}`, 'proc', `${idPath}_ip${p}`);
    lines.push(`import ${ident} from ${JSON.stringify(proc.path)};`);
    inputProcessorIdents.push(ident);
  }

  const outputProcessorIdents: string[] = [];
  for (let p = 0; p < agent.outputProcessors.length; p++) {
    const proc = agent.outputProcessors[p]!;
    const ident = sanitizeIdentifier(`${agent.name}_outputProc_${proc.key}`, 'proc', `${idPath}_op${p}`);
    lines.push(`import ${ident} from ${JSON.stringify(proc.path)};`);
    outputProcessorIdents.push(ident);
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

  // Declared subagents. Each is itself an `assembleAgentFromFsEntry` entry
  // object, recursively carrying its own `subagents`.
  const subagentExprs: string[] = [];
  for (let c = 0; c < agent.subagents.length; c++) {
    const child = agent.subagents[c]!;
    const childExpr = await emitAgentEntry(child, `${idPath}_${c}`, `${workspaceName}/${child.name}`, lines);
    subagentExprs.push(childExpr);
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
  if (inputProcessorIdents.length > 0) {
    entryFields.push(`inputProcessors: [${inputProcessorIdents.join(', ')}]`);
  }
  if (outputProcessorIdents.length > 0) {
    entryFields.push(`outputProcessors: [${outputProcessorIdents.join(', ')}]`);
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
 *    declared `subagents/` into the parent (nested up to `MAX_FS_SUBAGENT_DEPTH`),
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
export async function generateFsAgentsModule(
  userEntry: string | undefined,
  agents: DiscoveredFsAgent[],
  options?: {
    workflows?: DiscoveredFsWorkflow[];
    storage?: DiscoveredFsSingleton;
    observability?: DiscoveredFsSingleton;
    server?: DiscoveredFsSingleton;
    studio?: DiscoveredFsSingleton;
  },
): Promise<string> {
  const workflows = options?.workflows ?? [];
  const storage = options?.storage;
  const observability = options?.observability;
  const server = options?.server;
  const studio = options?.studio;
  const standalone = userEntry === undefined;
  const lines: string[] = [];

  const hasInlineSkills = (function check(list: DiscoveredFsAgent[]): boolean {
    return list.some(a => (a.skills ?? []).some(s => s.kind === 'packaged') || check(a.subagents ?? []));
  })(agents);

  lines.push(`import { assembleAgentFromFsEntry } from '@mastra/core/agent';`);
  if (hasInlineSkills) {
    lines.push(`import { createSkill as __createSkill } from '@mastra/core/skills';`);
  }
  if (standalone) {
    lines.push(`import { Mastra } from '@mastra/core';`);
  }
  lines.push(`import { fileURLToPath as __fileURLToPath } from 'node:url';`);
  lines.push(`import { dirname as __dirname, join as __join } from 'node:path';`);
  if (userEntry) {
    lines.push(`import * as __userEntry from ${JSON.stringify(userEntry)};`);
    lines.push(`export * from ${JSON.stringify(userEntry)};`);
  }
  lines.push(``);
  // Resolve workspace base paths relative to this bundled module so they point
  // at `<bundle>/workspace/<name>` wherever the bundle is deployed. Seed files
  // authored under `agents/<name>/workspace/**` are mirrored there at build time.
  // `name` may be a slash-joined path (`<parent>/<child>`) for subagents.
  lines.push(`const __bundleDir = __dirname(__fileURLToPath(import.meta.url));`);
  lines.push(`const __workspaceBasePath = name => __join(__bundleDir, 'workspace', ...name.split('/'));`);
  lines.push(``);

  // Singleton imports (storage.ts, observability.ts, etc.).
  const singletonImports: string[] = [];
  if (storage) {
    singletonImports.push(`import __fsStorage from ${JSON.stringify(storage.path)};`);
  }
  if (observability) {
    singletonImports.push(`import __fsObservability from ${JSON.stringify(observability.path)};`);
  }
  if (server) {
    singletonImports.push(`import __fsServer from ${JSON.stringify(server.path)};`);
  }
  if (studio) {
    singletonImports.push(`import __fsStudio from ${JSON.stringify(studio.path)};`);
  }
  if (singletonImports.length > 0) {
    lines.push(...singletonImports);
    lines.push(``);
  }

  const wfCodegen = workflows.length > 0 ? generateFsWorkflowsCodegen(workflows) : undefined;

  // Workflow imports (placed alongside other imports, before agent entries).
  if (wfCodegen) {
    for (const line of wfCodegen.importLines) {
      lines.push(line);
    }
    lines.push(``);
  }

  const entryExprs: string[] = [];
  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i]!;
    const expr = await emitAgentEntry(agent, `${i}`, agent.name, lines);
    entryExprs.push(expr);
  }

  // In standalone mode (no user entry), auto-construct a Mastra instance.
  // In wrapper mode, reference the user's exported instance.
  if (standalone) {
    lines.push(``);
    lines.push(`const __mastra = new Mastra({});`);
  } else {
    lines.push(``);
    lines.push(`const __mastra = __userEntry.mastra;`);
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
  lines.push(`    onWarn: msg => __mastra?.getLogger?.()?.warn?.(msg) ?? console.warn(msg),`);
  lines.push(`  });`);
  lines.push(`}`);
  lines.push(``);

  // Singleton registration (storage, observability, etc.) MUST run before
  // agents/workflows. `addMemory`/`addAgent` bind the current store to
  // storage-dependent primitives at registration time, so the fs singletons
  // have to be in place first — otherwise fs-discovered agents/workflows would
  // stay bound to the default InMemoryStore.
  if (storage) {
    lines.push(`if (__mastra && typeof __mastra.__registerFsStorage === 'function') {`);
    lines.push(`  __mastra.__registerFsStorage(__fsStorage);`);
    lines.push(`}`);
    lines.push(``);
  }

  if (observability) {
    lines.push(`if (__mastra && typeof __mastra.__registerFsObservability === 'function') {`);
    lines.push(`  __mastra.__registerFsObservability(__fsObservability);`);
    lines.push(`}`);
    lines.push(``);
  }

  if (server) {
    lines.push(`if (__mastra && typeof __mastra.__registerFsServer === 'function') {`);
    lines.push(`  __mastra.__registerFsServer(__fsServer);`);
    lines.push(`}`);
    lines.push(``);
  }

  if (studio) {
    lines.push(`if (__mastra && typeof __mastra.__registerFsStudio === 'function') {`);
    lines.push(`  __mastra.__registerFsStudio(__fsStudio);`);
    lines.push(`}`);
    lines.push(``);
  }

  lines.push(`if (__mastra && typeof __mastra.__registerFsAgents === 'function') {`);
  lines.push(`  __mastra.__registerFsAgents(__fsAgents);`);
  lines.push(`}`);

  // Workflow registration (after agents, before final export).
  if (wfCodegen) {
    lines.push(``);

    for (const line of wfCodegen.registrationLines) {
      lines.push(line);
    }
  }

  lines.push(``);
  lines.push(`export const mastra = __mastra;`);

  return lines.join('\n');
}

/**
 * Generate the workflow-registration lines to splice into the generated wrapper
 * module. Emits import statements for each discovered workflow module and a
 * registration block that calls `__registerFsWorkflows` on the user's mastra.
 *
 * Returns `{ importLines, registrationLines }` so the caller can place them at
 * the correct positions in the wrapper source.
 */
export function generateFsWorkflowsCodegen(workflows: DiscoveredFsWorkflow[]): {
  importLines: string[];
  registrationLines: string[];
} {
  const importLines: string[] = [];
  const registrationLines: string[] = [];

  for (let i = 0; i < workflows.length; i++) {
    const wf = workflows[i]!;
    const ident = sanitizeIdentifier(wf.key, 'workflow', `${i}`);
    importLines.push(`import ${ident} from ${JSON.stringify(wf.path)};`);
  }

  registrationLines.push(`const __fsWorkflows = Object.create(null);`);
  for (let i = 0; i < workflows.length; i++) {
    const wf = workflows[i]!;
    const ident = sanitizeIdentifier(wf.key, 'workflow', `${i}`);
    registrationLines.push(`__fsWorkflows[${JSON.stringify(wf.key)}] = ${ident};`);
  }
  registrationLines.push(``);
  registrationLines.push(`if (__mastra && typeof __mastra.__registerFsWorkflows === 'function') {`);
  registrationLines.push(`  __mastra.__registerFsWorkflows(__fsWorkflows);`);
  registrationLines.push(`}`);

  return { importLines, registrationLines };
}
