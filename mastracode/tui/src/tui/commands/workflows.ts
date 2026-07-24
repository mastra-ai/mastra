/**
 * /workflows slash command — drive workflow read + run + delete operations
 * without going through the LLM. Authoring (`save`) is intentionally not here;
 * saving is the chat's job via the `create-workflow` tool in build mode.
 *
 * The service layer (mastracode/sdk/src/workflows/service.ts) is the single
 * implementation; agent tools and this slash handler both call it.
 */
import { randomUUID } from 'node:crypto';
import { deleteWorkflow, getWorkflow, listWorkflows, runWorkflow } from '@mastra/code-sdk/workflows/service';
import type { StoredWorkflowRow, WorkflowRunEvent } from '@mastra/code-sdk/workflows/service';
import { RequestContext } from '@mastra/core/request-context';
import type { SlashCommandContext } from './types.js';

/**
 * Build the minimal `AgentControllerRequestContext`-shaped controller value
 * needed by mastracode's dynamic-model / dynamic-tools resolvers so that a
 * workflow's `code-agent` step can look up the current session's model.
 *
 * Chat-driven runs (via the `run-workflow` tool) already inherit a full
 * context from the parent agent's turn; this shim exists so `/workflows run`
 * works too. Fields not needed by downstream resolvers are intentionally
 * omitted.
 */
function buildSessionRequestContext(ctx: SlashCommandContext): RequestContext | undefined {
  const session = ctx.session;
  if (!session) return undefined;
  // Mirror the canonical modelId fallback chain in mastracode/src/index.ts:471-505.
  // A session's model.get() returns '' unless the user has explicitly picked
  // one via /models on this session — otherwise the effective model comes from
  // the current mode's defaultModelId. Without this fallback, code-agent's
  // getDynamicModel throws "No model selected" when it runs inside a workflow.
  const modeId = session.mode?.get?.() ?? '';
  const defaultModeModelId = ctx.controller.listModes().find(m => m.id === modeId)?.defaultModelId;
  const modelId = session.model?.get?.() || defaultModeModelId || '';
  const controllerContext = {
    controllerId: ctx.controller.id,
    state: session.state?.get?.() ?? {},
    getState: () => session.state?.get?.() ?? {},
    setState: (updates: Record<string, unknown>) => session.state?.set?.(updates),
    threadId: session.thread?.getId?.() ?? undefined,
    resourceId: session.identity?.getResourceId?.() ?? undefined,
    session: {
      id: session.identity?.getId?.() ?? '',
      ownerId: session.identity?.getOwnerId?.() ?? '',
      modeId,
      modelId,
      state: {
        get: () => session.state?.get?.() ?? {},
        set: (updates: Record<string, unknown>) => session.state?.set?.(updates),
        update: (updater: unknown) => session.state?.update?.(updater as never),
      },
    },
  };
  const requestContext = new RequestContext();
  requestContext.set('controller', controllerContext);

  // MastraMemory is what `ObservationalMemory` (and `WorkingMemory` /
  // `SemanticRecall`) read to find the current thread — see
  // packages/memory/src/processors/observational-memory/observational-memory.ts:1639-1675.
  // Normal chat turns get this populated by prepare-memory-step after
  // memory.getOrCreateThread(); the workflow engine doesn't forward memory
  // options to agent.stream(), so if we don't set this here, any memory-aware
  // processor on code-agent throws.
  //
  // A fresh UUID per run keeps workflow-scoped observations from polluting
  // the current chat thread. If we later want workflow observations visible
  // in the parent thread, swap in `session.thread?.getId?.()`.
  const resourceId = session.identity?.getResourceId?.() ?? '';
  requestContext.set('MastraMemory', {
    thread: { id: randomUUID() },
    resourceId,
    memoryConfig: undefined,
  });

  return requestContext;
}

/**
 * Compact single-line rendering of a JSON schema's top-level properties.
 * Nested objects render as `{...}`, arrays as `[...]`. Not a general JSON-schema
 * pretty-printer — just enough for the `/workflows show` header to communicate
 * shape at a glance.
 */
function renderSchemaOneLine(schema: unknown): string {
  if (!schema || typeof schema !== 'object') return '<schema>';
  const s = schema as { properties?: Record<string, { type?: string }>; type?: string };
  if (!s.properties) return s.type ? `<${s.type}>` : '<schema>';
  const parts = Object.entries(s.properties).map(([key, prop]) => {
    const t = prop?.type ?? 'unknown';
    const rendered = t === 'object' ? '{...}' : t === 'array' ? '[...]' : t;
    return `${key}: ${rendered}`;
  });
  return `{ ${parts.join(', ')} }`;
}

interface SerializedInnerStep {
  type: string;
  id?: string;
  agentId?: string;
  toolId?: string;
  step?: { id?: string };
}

interface SerializedStepEntry {
  type: string;
  id?: string;
  agentId?: string;
  toolId?: string;
  stepId?: string;
  steps?: SerializedInnerStep[];
  step?: SerializedInnerStep;
  opts?: { concurrency?: number };
  loopType?: 'dowhile' | 'dountil';
}

/**
 * One-line label for a nested single-step entry (agent/tool/mapping/step).
 * Used inside parallel/foreach/loop containers so the reader can see WHICH
 * step is being fanned out or looped over.
 */
function labelInnerStep(inner: SerializedInnerStep | undefined): string {
  if (!inner) return '?';
  switch (inner.type) {
    case 'agent':
      return `${inner.id ?? '?'} · agent → ${inner.agentId ?? '?'}`;
    case 'tool':
      return `${inner.id ?? '?'} · tool → ${inner.toolId ?? '?'}`;
    case 'mapping':
      return `${inner.id ?? '?'} · mapping`;
    case 'step':
      return `${inner.step?.id ?? inner.id ?? '?'} · step`;
    default:
      return `${inner.id ?? '?'} · ${inner.type}`;
  }
}

/**
 * Container entries (foreach / loop / parallel / conditional) have no top-level
 * `id` in the serialized graph — synthesize a stable display title from the
 * inner step(s) so users can tell them apart.
 */
function containerTitle(index: number, entry: SerializedStepEntry): string {
  const n = `${index + 1}.`;
  switch (entry.type) {
    case 'foreach':
      return `${n} foreach(${entry.step?.id ?? '?'})`;
    case 'loop':
      return `${n} ${entry.loopType ?? 'loop'}(${entry.step?.id ?? '?'})`;
    case 'parallel':
      return `${n} parallel`;
    case 'conditional':
      return `${n} conditional`;
    default:
      return `${n} ${entry.id ?? '(unnamed)'}`;
  }
}

/**
 * Render a stored workflow as a compact ASCII diagram. Linear steps render as
 * a single box; container steps (parallel / conditional / foreach / loop)
 * render an outer box plus one indented sub-box per inner step so the reader
 * can see WHAT is being fanned out, iterated, or branched over.
 */
function renderWorkflowDefinition(def: StoredWorkflowRow): string {
  const lines: string[] = [];
  const header = def.description ? `${def.id}  (${def.status})\n${def.description}` : `${def.id}  (${def.status})`;
  lines.push(header, '');
  lines.push(`Input:   ${renderSchemaOneLine(def.inputSchema)}`);
  lines.push(`Output:  ${renderSchemaOneLine(def.outputSchema)}`);
  lines.push('');

  const graph = (def.graph ?? []) as SerializedStepEntry[];
  if (graph.length === 0) {
    lines.push('(no steps)');
    return lines.join('\n');
  }

  const BOX_WIDTH = 45;
  const inner = BOX_WIDTH - 2;
  const pad = (text: string) => {
    const trimmed = text.length > inner - 2 ? text.slice(0, inner - 3) + '…' : text;
    return ` ${trimmed.padEnd(inner - 1)}`;
  };
  const top = `┌${'─'.repeat(inner)}┐`;
  const mid = `├${'─'.repeat(inner)}┤`;
  const bot = `└${'─'.repeat(Math.floor(inner / 2))}┬${'─'.repeat(inner - Math.floor(inner / 2) - 1)}┘`;
  const botFlat = `└${'─'.repeat(inner)}┘`;
  const gap = `${' '.repeat(Math.floor(inner / 2) + 1)}│`;
  const arrow = `${' '.repeat(Math.floor(inner / 2) + 1)}▼`;

  const pushBox = (title: string, subtitles: string[], last: boolean) => {
    lines.push(top);
    lines.push(`│${pad(title)}│`);
    for (const s of subtitles) lines.push(`│${pad(s)}│`);
    lines.push(last ? botFlat : bot);
    if (!last) {
      lines.push(gap, arrow);
    } else {
      lines.push(`${' '.repeat(Math.floor(inner / 2) - 2)}(output)`);
    }
  };

  const pushContainerBox = (title: string, headerLine: string, innerLabels: string[], last: boolean) => {
    lines.push(top);
    lines.push(`│${pad(title)}│`);
    lines.push(`│${pad(headerLine)}│`);
    lines.push(mid);
    if (innerLabels.length === 0) {
      lines.push(`│${pad('(empty)')}│`);
    } else {
      for (const label of innerLabels) lines.push(`│${pad(`  • ${label}`)}│`);
    }
    lines.push(last ? botFlat : bot);
    if (!last) {
      lines.push(gap, arrow);
    } else {
      lines.push(`${' '.repeat(Math.floor(inner / 2) - 2)}(output)`);
    }
  };

  graph.forEach((entry, i) => {
    const last = i === graph.length - 1;
    switch (entry.type) {
      case 'agent':
        pushBox(`${i + 1}. ${entry.id ?? '(unnamed)'}`, [`agent → ${entry.agentId ?? '?'}`], last);
        break;
      case 'tool':
        pushBox(`${i + 1}. ${entry.id ?? '(unnamed)'}`, [`tool → ${entry.toolId ?? '?'}`], last);
        break;
      case 'mapping':
        pushBox(`${i + 1}. ${entry.id ?? '(unnamed)'}`, ['mapping'], last);
        break;
      case 'step':
        pushBox(`${i + 1}. ${entry.id ?? '(unnamed)'}`, [`step → ${entry.stepId ?? '?'}`], last);
        break;
      case 'sleep':
        pushBox(`${i + 1}. ${entry.id ?? '(unnamed)'}`, ['sleep'], last);
        break;
      case 'sleepUntil':
        pushBox(`${i + 1}. ${entry.id ?? '(unnamed)'}`, ['sleepUntil'], last);
        break;
      case 'foreach': {
        const concurrency = entry.opts?.concurrency ?? 1;
        pushContainerBox(
          containerTitle(i, entry),
          `foreach — concurrency ${concurrency}`,
          [labelInnerStep(entry.step)],
          last,
        );
        break;
      }
      case 'loop': {
        pushContainerBox(containerTitle(i, entry), `${entry.loopType ?? 'loop'}`, [labelInnerStep(entry.step)], last);
        break;
      }
      case 'parallel': {
        const branches = Array.isArray(entry.steps) ? entry.steps : [];
        pushContainerBox(
          containerTitle(i, entry),
          `parallel — ${branches.length} branch${branches.length === 1 ? '' : 'es'}`,
          branches.map(labelInnerStep),
          last,
        );
        break;
      }
      case 'conditional': {
        const branches = Array.isArray(entry.steps) ? entry.steps : [];
        pushContainerBox(
          containerTitle(i, entry),
          `conditional — ${branches.length} branch${branches.length === 1 ? '' : 'es'}`,
          branches.map(labelInnerStep),
          last,
        );
        break;
      }
      default:
        pushBox(`${i + 1}. ${entry.id ?? '(unnamed)'}`, [entry.type], last);
    }
  });

  return lines.join('\n');
}

function help(ctx: SlashCommandContext): void {
  ctx.showInfo(
    [
      'Workflows — manage chat-built static workflows.',
      '',
      '  /workflows [list]         List saved workflows.',
      '  /workflows show <id>      Pretty-print the full graph + schemas.',
      '  /workflows run <id> <json>',
      '                            Run the workflow with the given input.',
      '  /workflows delete <id>    Remove a workflow from storage.',
      '  /workflows help           Show this help.',
      '',
      'To CREATE a workflow, ask the chat in build mode:',
      '  > build me a workflow that …',
    ].join('\n'),
  );
}

export async function handleWorkflowsCommand(ctx: SlashCommandContext, args: string[]): Promise<void> {
  const sub = args[0]?.toLowerCase() ?? 'list';
  const mastra = ctx.controller.getMastra();
  if (!mastra) {
    ctx.showError('Workflows: no Mastra instance attached to this controller.');
    return;
  }

  try {
    switch (sub) {
      case 'list': {
        const { workflows } = await listWorkflows(mastra);
        if (workflows.length === 0) {
          ctx.showInfo('No saved workflows. Ask the chat in build mode to "build a workflow that …".');
          return;
        }
        const lines = workflows.map(wf => {
          const head = `- ${wf.id} (${wf.status})`;
          return wf.description ? `${head} — ${wf.description}` : head;
        });
        ctx.showInfo(lines.join('\n'));
        return;
      }
      case 'show': {
        const id = args[1];
        if (!id) {
          ctx.showError('Usage: /workflows show <id>');
          return;
        }
        const def = await getWorkflow(mastra, id);
        if (!def) {
          ctx.showError(`No workflow with id "${id}".`);
          return;
        }
        ctx.showInfo(JSON.stringify(def, null, 2));
        ctx.showInfo(renderWorkflowDefinition(def));
        return;
      }
      case 'run': {
        const id = args[1];
        const rawInput = args.slice(2).join(' ').trim() || '{}';
        if (!id) {
          ctx.showError('Usage: /workflows run <id> <json-input>');
          return;
        }
        let inputData: unknown;
        try {
          inputData = JSON.parse(rawInput);
        } catch (e) {
          ctx.showError(`Invalid JSON input: ${(e as Error).message}`);
          return;
        }
        // Pass a session-derived request context so any `code-agent` agent steps
        // can resolve the current model. Without this the workflow would fail
        // with "No model selected" the moment code-agent tries to run.
        ctx.showInfo(`▶ Running "${id}"`);
        const timings = new Map<string, number>();
        const result = await runWorkflow(
          mastra,
          id,
          inputData,
          buildSessionRequestContext(ctx),
          (evt: WorkflowRunEvent) => {
            const stepId = typeof evt.payload?.id === 'string' ? evt.payload.id : undefined;
            switch (evt.type) {
              case 'workflow-step-start': {
                if (!stepId) return;
                timings.set(stepId, Date.now());
                ctx.showInfo(`  ▶ ${stepId}`);
                return;
              }
              case 'workflow-step-result': {
                if (!stepId) return;
                const started = timings.get(stepId);
                const ms = started ? Date.now() - started : undefined;
                const status = (evt.payload as { status?: string } | undefined)?.status;
                const mark = status === 'success' ? '✓' : status === 'failed' ? '✗' : '·';
                ctx.showInfo(`  ${mark} ${stepId}${ms !== undefined ? ` (${ms}ms)` : ''}`);
                return;
              }
              default:
                return;
            }
          },
        );
        if (result.status === 'success') {
          const body = result.result !== undefined ? `\n\n${JSON.stringify(result.result, null, 2)}` : '';
          ctx.showInfo(`✓ done${body}`);
        } else {
          const message =
            (result.error as { message?: string } | undefined)?.message ??
            (typeof result.error === 'string' ? result.error : 'unknown');
          ctx.showError(`✗ workflow failed: ${message}`);
        }
        return;
      }
      case 'delete': {
        const id = args[1];
        if (!id) {
          ctx.showError('Usage: /workflows delete <id>');
          return;
        }
        await deleteWorkflow(mastra, id);
        ctx.showInfo(`Deleted workflow "${id}". (In-process Workflow instance stays until next restart.)`);
        return;
      }
      case 'help':
      case '?':
      case '--help':
        help(ctx);
        return;
      default:
        ctx.showError(`Unknown /workflows subcommand: "${sub}". Try /workflows help.`);
    }
  } catch (e) {
    ctx.showError(`Workflow command failed: ${(e as Error).message}`);
  }
}
