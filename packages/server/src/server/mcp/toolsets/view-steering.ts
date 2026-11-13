import type { JSONSchema7 } from '@mastra/schema-compat';
import { GET_CAPABILITIES } from '../../handlers/observability-new-endpoints';
import { toolError } from '../catalogue';
import type { Args, CatalogueKit, ModelSummary } from '../catalogue';
import { object, str } from '../schema';
import { readView, viewOwner, writeView } from '../view-state';
import type { SteerableTool, ViewRecord, ViewState } from '../view-state';
import { summarizeTrace } from './observability-summary';

export const STEER_VIEW_TOOL = 'steer_observability_view';
export const SYNC_VIEW_TOOL = 'sync_observability_view';

const READ_ONLY = { readOnlyHint: true };

/** Whether two states show the same list and trace, whatever the view says about them. */
function sameView(a: ViewState | null, b: ViewState): boolean {
  const { context: _a, ...shown } = a ?? {};
  const { context: _b, ...next } = b;
  return stable(shown) === stable(next);
}

/** JSON with object keys sorted, so key order doesn't count as a difference. */
function stable(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );
}

/** What the model is told a view shows. */
function describe(viewId: string, record: ViewRecord): string {
  const { state } = record;
  if (!state) return `View ${viewId} still shows what the call that opened it returned; nobody has changed it.`;
  const parts = [
    state.tool ? `the ${state.tool} result for ${JSON.stringify(state.args ?? {})}` : 'the list it opened with',
    state.traceId && `with trace ${state.traceId} open`,
    state.spanId && `and span ${state.spanId} selected`,
  ].filter(Boolean);
  const screen = state.context ? `\nOn screen now: ${state.context}` : '';
  if (record.by === 'app') {
    return `View ${viewId} was set to ${parts.join(' ')}; the user has changed it in the view since.${screen}`;
  }
  return `View ${viewId} shows ${parts.join(' ')}. Last changed by you.${screen}`;
}

/**
 * Tools that change what an open observability explorer shows, without opening another one. The explorer
 * polls its record in the server cache with the app-only sync tool and writes the user's own changes back,
 * so the model can read them. Neither tool links an app, so hosts render no new view for them.
 */
export function addViewSteeringTools(kit: CatalogueKit, steerable: Map<SteerableTool, ModelSummary>) {
  const { add, run, mastra, requestContext } = kit;
  const cache = mastra.getServerCache();
  const owner = viewOwner(requestContext);
  const tools = [...steerable.keys()];
  const viewId = str('The view id from the result that opened the observability explorer.');
  const traceId = str('Open this trace over the list. Leave out to close an open trace.');
  const spanId = str('With traceId, select this span in the trace.');

  add(
    STEER_VIEW_TOOL,
    GET_CAPABILITIES,
    'Change what an observability explorer the user already has open shows, instead of calling ' +
      `${tools.join(', ')} again (which opens another view). Pass tool and args to show that tool's result ` +
      '(its tab, filters, time range, and sort), and/or traceId to open a trace. Returns what the view now shows. ' +
      "Call with only viewId to read what it shows, including the user's own changes.",
    object(
      {
        viewId,
        tool: { type: 'string', enum: tools, description: 'Show what this tool returns for args.' },
        args: { type: 'object', additionalProperties: true, description: 'The tool arguments, as you would call it.' },
        traceId,
        spanId,
      },
      ['viewId'],
    ),
    async (args, signal) => {
      const record = await readView(cache, args.viewId, owner);
      if (!args.tool && !args.traceId) return { text: describe(args.viewId, record) };
      if (args.spanId && !args.traceId) throw toolError(400, 'spanId needs traceId.');

      const state: ViewState = args.tool
        ? { tool: args.tool, args: (args.args as Args | undefined) ?? {} }
        : { ...(record.state ?? {}) };
      delete state.traceId;
      delete state.spanId;
      delete state.context;
      if (args.traceId) state.traceId = args.traceId;
      if (args.spanId) state.spanId = args.spanId;

      // Run what the view will show first: bad arguments fail here, before the view changes.
      const read: string[] = [];
      if (args.tool) {
        const output = JSON.parse(JSON.stringify(await run(args.tool, state.args!, signal))) as Args;
        read.push(steerable.get(args.tool as SteerableTool)!(output));
      }
      if (args.traceId) {
        const trace = JSON.parse(JSON.stringify(await run('get_trace', { traceId: args.traceId }, signal))) as Args;
        read.push(summarizeTrace(trace));
      }
      const updated = await writeView(cache, args.viewId, owner, state, 'model');
      return { text: [`${describe(args.viewId, updated)} The user sees it now.`, ...read].join('\n\n') };
    },
    { annotations: READ_ONLY, summary: output => String(output.text) },
  );

  const stateSchema: JSONSchema7 = object({
    tool: { type: 'string', enum: tools },
    args: { type: 'object', additionalProperties: true },
    traceId: { type: 'string' },
    spanId: { type: 'string' },
    context: { type: 'string', maxLength: 4000 },
  });
  stateSchema.additionalProperties = false;
  add(
    SYNC_VIEW_TOOL,
    GET_CAPABILITIES,
    "The observability explorer's own sync: reads changes since a version, or writes the user's changes.",
    object(
      {
        viewId,
        since: { type: 'integer', minimum: 0, description: 'Only return the state when its version is newer.' },
        state: stateSchema,
        base: { type: 'integer', minimum: 0, description: 'With state: the version the view shows.' },
      },
      ['viewId'],
    ),
    async args => {
      if (args.state) {
        const state = args.state as ViewState;
        const current = await readView(cache, args.viewId, owner);
        // The view's first report after the model's change (which clears what was on screen) describes that
        // change, as does a repeat of the last report; anything else on screen is the user's doing.
        const unchanged =
          sameView(current.state, state) &&
          (current.state?.context === undefined || current.state.context === state.context);
        const by = unchanged ? current.by : 'app';
        const { version } = await writeView(cache, args.viewId, owner, state, by, args.base);
        return { version };
      }
      const record = await readView(cache, args.viewId, owner);
      return record.version > (args.since ?? -1)
        ? { version: record.version, by: record.by, state: record.state }
        : { version: record.version };
    },
    { annotations: READ_ONLY, meta: { ui: { resourceUri: kit.apps.observabilityExplorer, visibility: ['app'] } } },
  );
}
