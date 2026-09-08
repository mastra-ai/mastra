import { buildContextAudit } from '@mastra/code-sdk/agents/context-audit';
import type { ContextAudit, ContextAuditGroup, ContextAuditTool } from '@mastra/code-sdk/agents/context-audit';
import { getDynamicInstructionSections } from '@mastra/code-sdk/agents/instructions';
import { formatSkillsCatalog } from '@mastra/core/processors';
import type { SlashCommandContext } from './types.js';

/**
 * `getDynamicInstructionSections` reads the session through the same
 * `requestContext.get('controller')` handle the agent uses, of which it only
 * needs live state and the session's mode and model. Supplying that shape
 * directly means the audit is built from the session as it is right now,
 * without starting a request.
 */
function requestContextForSession(ctx: SlashCommandContext) {
  const session = ctx.state.session;
  return {
    get: (key: string) =>
      key === 'controller'
        ? {
            getState: () => session.state.get(),
            session: { modeId: session.mode.get(), modelId: session.model.get() },
          }
        : undefined,
  };
}

/**
 * Rebuild the skills catalog exactly as the skills processor injects it. The
 * `${path}/SKILL.md` location matches the processor default, which Mastra Code
 * does not override.
 */
async function collectSkillsCatalog(ctx: SlashCommandContext): Promise<string | undefined> {
  let workspace = ctx.getResolvedWorkspace();
  if (!workspace && ctx.controller.hasWorkspace()) {
    workspace = await ctx.controller.resolveWorkspace({ session: ctx.state.session });
  }
  if (!workspace?.skills) return undefined;

  const listed = await workspace.skills.list();
  if (listed.length === 0) return undefined;

  const skills = (await Promise.all(listed.map(meta => workspace!.skills!.get(meta.path)))).filter(
    (skill): skill is NonNullable<typeof skill> => !!skill,
  );
  const deduped = Array.from(new Map(skills.map(skill => [skill.path, skill])).values());

  return formatSkillsCatalog(
    deduped.map(skill => ({
      name: skill.name,
      description: skill.description,
      location: `${skill.path}/SKILL.md`,
      source: skill.source.type,
    })),
  );
}

/** MCP tool definitions, attributed to the server that provides each one. */
function collectMcpTools(ctx: SlashCommandContext): ContextAuditTool[] {
  const manager = ctx.mcpManager;
  if (!manager) return [];

  const tools = manager.getTools();
  const serverByTool = new Map<string, string>();
  for (const status of manager.getServerStatuses()) {
    for (const toolName of status.toolNames) serverByTool.set(toolName, status.name);
  }

  return Object.entries(tools).map(([name, tool]) => ({
    name,
    description: typeof tool?.description === 'string' ? tool.description : undefined,
    parameters: tool?.inputSchema ?? tool?.parameters,
    server: serverByTool.get(name) ?? 'mcp',
  }));
}

function formatTokens(tokens: number): string {
  return tokens.toLocaleString();
}

function formatPercent(percent: number): string {
  if (percent > 0 && percent < 0.1) return '<0.1%';
  return `${percent.toFixed(1)}%`;
}

/** Collapse a group's entries when one source dominates the line count. */
function formatGroup(group: ContextAuditGroup): string {
  const lines = [
    `  ${group.label.padEnd(24)} ${formatTokens(group.tokens).padStart(8)}  ${formatPercent(group.percent)}`,
  ];

  // A chatty MCP server can contribute dozens of tools; roll them up per
  // provider so one server does not bury the rest of the report.
  const byDetail = new Map<string, { tokens: number; count: number }>();
  for (const entry of group.entries) {
    const key = entry.detail ?? entry.label;
    const existing = byDetail.get(key) ?? { tokens: 0, count: 0 };
    byDetail.set(key, { tokens: existing.tokens + entry.tokens, count: existing.count + 1 });
  }

  const rollUp = group.id === 'tools' && group.entries.length > byDetail.size;
  const rows = rollUp
    ? [...byDetail.entries()].map(([detail, agg]) => ({
        label: `${detail} (${agg.count} tool${agg.count === 1 ? '' : 's'})`,
        tokens: agg.tokens,
      }))
    : group.entries.map(entry => ({ label: entry.detail ?? entry.label, tokens: entry.tokens }));

  for (const row of rows.sort((a, b) => b.tokens - a.tokens)) {
    lines.push(`    ${row.label.padEnd(22)} ${formatTokens(row.tokens).padStart(8)}`);
  }
  if (group.note) lines.push(`    ${group.note}`);
  return lines.join('\n');
}

export function formatContextAudit(audit: ContextAudit, notes: string[]): string {
  const sections: string[] = [];

  sections.push(
    `Context Audit (~${formatTokens(audit.totalTokens)} tokens, estimated)`,
    '',
    `Startup context   ${formatTokens(audit.startup.tokens).padStart(8)}  ${formatPercent(audit.startup.percent)}`,
    ...audit.startup.groups.map(formatGroup),
  );

  if (audit.accumulated.groups.length > 0) {
    sections.push(
      '',
      `Accumulated       ${formatTokens(audit.accumulated.tokens).padStart(8)}  ${formatPercent(audit.accumulated.percent)}`,
      ...audit.accumulated.groups.map(formatGroup),
    );
  }

  sections.push('', ...notes.map(note => `Note: ${note}`));
  return sections.join('\n');
}

export async function handleContextCommand(ctx: SlashCommandContext): Promise<void> {
  try {
    const instructionSections = await getDynamicInstructionSections({
      requestContext: requestContextForSession(ctx),
    });

    let skillsCatalog: string | undefined;
    try {
      skillsCatalog = await collectSkillsCatalog(ctx);
    } catch {
      // A workspace that cannot be resolved should cost the audit its skills
      // line, not the whole report.
      skillsCatalog = undefined;
    }

    const displayState = ctx.state.session.displayState.get();
    const audit = buildContextAudit({
      instructionSections,
      skillsCatalog,
      tools: collectMcpTools(ctx),
      conversation: { promptTokens: ctx.state.latestRequestPromptTokens },
      // The OM subsystem reports the size of what it put in the context, which
      // beats re-measuring the rendered observation text.
      injectedObservations: { tokens: displayState.omProgress.observationTokens },
    });

    const notes = [
      'Percentages are shares of the audited total, not of the model context window.',
      'Token counts are estimates; the provider is authoritative.',
      'Built-in and workspace tool definitions are not itemised.',
    ];

    // Rendered to the terminal only — the audit never becomes part of the
    // context it is describing.
    ctx.showInfo(formatContextAudit(audit, notes));
  } catch (error) {
    ctx.showError(`Failed to audit context: ${error instanceof Error ? error.message : String(error)}`);
  }
}
