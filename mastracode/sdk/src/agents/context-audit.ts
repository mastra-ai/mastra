/**
 * Context audit — accounts for what occupies the model's context window.
 *
 * Deliberately pure: callers collect the real strings (prompt sections, the
 * injected skills catalog, tool definitions) and this module only measures and
 * groups them. That keeps the audit honest — it reports on the same text the
 * model receives rather than a description of it — and keeps it testable
 * without a live session.
 *
 * Nothing here reads file contents or secrets: entries carry labels, origins
 * and sizes only, never the underlying text, so an audit can be shown or
 * pasted without leaking whatever the context happens to contain.
 */
import { tokenEstimate } from '../utils/token-estimator.js';
import type { PromptSection } from './prompts/index.js';

/** A single measured contributor to the context window. */
export interface ContextAuditEntry {
  id: string;
  label: string;
  /** Provenance: file path, server name, model id — whatever identifies the source. */
  detail?: string;
  tokens: number;
  characters: number;
  /** Share of the audit total, 0-100. */
  percent: number;
}

/** A category of contributors (e.g. all agent instruction files). */
export interface ContextAuditGroup {
  id: string;
  label: string;
  tokens: number;
  /** Share of the audit total, 0-100. */
  percent: number;
  entries: ContextAuditEntry[];
  /** Shown alongside the group when its numbers need qualifying. */
  note?: string;
}

export interface ContextAudit {
  /** Context present before the first message: system prompt, skills, tools. */
  startup: { tokens: number; percent: number; groups: ContextAuditGroup[] };
  /** Context accumulated by the session: conversation and observation memory. */
  accumulated: { tokens: number; percent: number; groups: ContextAuditGroup[] };
  /** Startup + accumulated. Percentages elsewhere are shares of this. */
  totalTokens: number;
  /** Estimated rather than measured: token counts come from a heuristic estimator. */
  estimated: true;
}

/** A tool definition as advertised to the model. */
export interface ContextAuditTool {
  name: string;
  description?: string;
  /** JSON schema (or any serializable shape) sent with the definition. */
  parameters?: unknown;
  /** MCP server that provides the tool, when it is not built in. */
  server?: string;
}

export interface ContextAuditInput {
  /** Labeled sections of the assembled system prompt. */
  promptSections?: PromptSection[];
  /** Labeled sections of the per-request dynamic instructions. */
  instructionSections?: PromptSection[];
  /** The skills catalog exactly as injected into the system message. */
  skillsCatalog?: string;
  /** Tool definitions advertised to the model. */
  tools?: ContextAuditTool[];
  /**
   * Observation memory currently occupying the context window, either as the
   * injected text or as a token count reported by the memory subsystem.
   *
   * Only observations that are actually in the context belong here.
   * Observations that merely sit in storage cost nothing until recalled, and
   * conflating the two is exactly the confusion this audit exists to resolve.
   */
  injectedObservations?: string | { tokens: number };
  /** Prompt tokens the provider reported for the most recent request. */
  conversation?: { promptTokens?: number };
}

function measure(id: string, label: string, content: string, detail?: string): ContextAuditEntry {
  return { id, label, detail, tokens: tokenEstimate(content), characters: content.length, percent: 0 };
}

function sectionEntries(sections: PromptSection[], prefix: string): ContextAuditEntry[] {
  return sections
    .filter(section => section.content.length > 0)
    .map(section => measure(`${prefix}:${section.id}`, section.label, section.content, section.detail));
}

function group(id: string, label: string, entries: ContextAuditEntry[], note?: string): ContextAuditGroup | undefined {
  if (entries.length === 0) return undefined;
  return { id, label, tokens: entries.reduce((sum, entry) => sum + entry.tokens, 0), percent: 0, entries, note };
}

/**
 * Group tool definitions by their provider so a chatty MCP server is visible as
 * one line rather than fifty. Per-tool entries stay available underneath.
 */
function toolEntries(tools: ContextAuditTool[]): ContextAuditEntry[] {
  return tools.map(tool => {
    // Approximates the serialized definition: name, description and schema are
    // what a provider sends, and the exact wire framing is provider-specific.
    const serialized = [tool.name, tool.description ?? '', tool.parameters ? JSON.stringify(tool.parameters) : ''].join(
      '\n',
    );
    return measure(`tool:${tool.server ?? 'built-in'}:${tool.name}`, tool.name, serialized, tool.server);
  });
}

function withPercent<T extends { tokens: number; percent: number }>(items: T[], total: number): T[] {
  for (const item of items) {
    item.percent = total > 0 ? (item.tokens / total) * 100 : 0;
  }
  return items;
}

function sumTokens(groups: ContextAuditGroup[]): number {
  return groups.reduce((sum, entry) => sum + entry.tokens, 0);
}

/**
 * Build a context audit from already-collected context.
 *
 * Percentages are shares of the audited total, not of the model's context
 * window: window size is not exposed by the model registry, and inventing one
 * would make every number wrong for models that disagree with the guess.
 */
export function buildContextAudit(input: ContextAuditInput): ContextAudit {
  const startupGroups = [
    group('system-prompt', 'System prompt', sectionEntries(input.promptSections ?? [], 'prompt')),
    group('dynamic-instructions', 'Dynamic instructions', sectionEntries(input.instructionSections ?? [], 'dynamic')),
    group(
      'skills',
      'Skills catalog',
      input.skillsCatalog ? [measure('skills:catalog', 'Available skills', input.skillsCatalog)] : [],
      'Skill instructions are loaded on demand and are not counted here.',
    ),
    group('tools', 'Tool definitions', toolEntries(input.tools ?? [])),
  ].filter((entry): entry is ContextAuditGroup => entry !== undefined);

  const observationEntries: ContextAuditEntry[] = [];
  if (typeof input.injectedObservations === 'string') {
    observationEntries.push(measure('observations:injected', 'Injected into context', input.injectedObservations));
  } else if (input.injectedObservations && input.injectedObservations.tokens > 0) {
    observationEntries.push({
      id: 'observations:injected',
      label: 'Injected into context',
      tokens: input.injectedObservations.tokens,
      characters: 0,
      percent: 0,
    });
  }

  const startupTokens = sumTokens(startupGroups);
  const injectedObservationTokens = observationEntries.reduce((sum, entry) => sum + entry.tokens, 0);

  // The provider's prompt token count covers the whole request — startup
  // context and injected observations included — so the conversation's own
  // contribution is what is left after subtracting everything already
  // accounted for. Using the raw prompt count would double-count all of it.
  const promptTokens = input.conversation?.promptTokens ?? 0;
  const conversationTokens = Math.max(0, promptTokens - startupTokens - injectedObservationTokens);
  const conversationEntries: ContextAuditEntry[] =
    promptTokens > 0
      ? [
          {
            id: 'conversation:messages',
            label: 'Messages, tool calls and results',
            tokens: conversationTokens,
            characters: 0,
            percent: 0,
          },
        ]
      : [];

  const accumulatedGroups = [
    group(
      'conversation',
      'Conversation',
      conversationEntries,
      `Derived from the provider's last request (~${promptTokens} prompt tokens) minus the startup context measured above.`,
    ),
    group(
      'observations',
      'Observation memory',
      observationEntries,
      'Observations kept only in storage are not counted: they cost nothing until recalled.',
    ),
  ].filter((entry): entry is ContextAuditGroup => entry !== undefined);

  const accumulatedTokens = sumTokens(accumulatedGroups);
  const totalTokens = startupTokens + accumulatedTokens;

  for (const entry of [...startupGroups, ...accumulatedGroups]) {
    withPercent(entry.entries, totalTokens);
  }
  withPercent(startupGroups, totalTokens);
  withPercent(accumulatedGroups, totalTokens);

  return {
    startup: {
      tokens: startupTokens,
      percent: totalTokens > 0 ? (startupTokens / totalTokens) * 100 : 0,
      groups: startupGroups,
    },
    accumulated: {
      tokens: accumulatedTokens,
      percent: totalTokens > 0 ? (accumulatedTokens / totalTokens) * 100 : 0,
      groups: accumulatedGroups,
    },
    totalTokens,
    estimated: true,
  };
}
