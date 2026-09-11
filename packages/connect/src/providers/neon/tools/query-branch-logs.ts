// AUTO-GENERATED from rhysbalevicius/integration-templates @ 2464f5a43eaa — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const queryBranchLogsInputSchema = z
  .object({
    project_id: z.string().regex(new RegExp('^[a-z0-9-]{1,60}$')).describe('The Neon project ID'),
    branch_id: z.string().regex(new RegExp('^[a-z0-9-]{1,60}$')).describe('The Neon branch ID'),
    body: z.object({
      since: z
        .string()
        .regex(new RegExp('^[0-9]{1,6}(ms|s|m|h|d)$'))
        .describe(
          'A length of time as a count and a unit, for example `30m`, `6h`, or\n`7d`. Valid units are `ms`, `s`, `m`, `h`, and `d`.\n',
        )
        .describe(
          'Length of the query window, ending at `end_time` or at the current\ntime when `end_time` is omitted. Mutually exclusive with\n`start_time`. Prefer this over computing absolute bounds when the\ncaller only means "the last hour".\n',
        )
        .optional(),
      start_time: z
        .string()
        .datetime({ offset: true })
        .describe(
          'Inclusive beginning of the query window. Mutually exclusive with\n`since`. Defaults to one hour before `end_time`, or one hour before\nthe current time when both bounds are omitted.\n',
        )
        .optional(),
      end_time: z
        .string()
        .datetime({ offset: true })
        .describe('Exclusive end of the query window. Defaults to the current time.')
        .optional(),
      limit: z.number().int().min(1).max(1000).describe('Maximum number of log records to return per page.').optional(),
      cursor: z
        .string()
        .describe(
          'Opaque pagination cursor returned as `next_cursor` by a previous\ncall. Resume the query after the last record of the previous page,\nrepeating the time range and every filter unchanged.\n',
        )
        .optional(),
      sort_order: z
        .enum(['asc', 'desc'])
        .describe('Order matching records by timestamp. `desc`, the default, returns\nthe newest records first.\n')
        .optional(),
      source: z
        .enum(['function', 'storage', 'pg_endpoint'])
        .describe('The Neon service that emitted the log record.')
        .optional(),
      service_name: z
        .string()
        .min(1)
        .describe('Match the OpenTelemetry `service.name` resource attribute exactly.')
        .optional(),
      scope_name: z.string().min(1).describe('Match the OpenTelemetry instrumentation scope name exactly.').optional(),
      minimum_severity: z
        .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
        .describe(
          'An OpenTelemetry severity level. A minimum severity includes every\nhigher level in this order: `trace`, `debug`, `info`, `warn`, `error`,\n`fatal`.\n',
        )
        .optional(),
      severity_text: z.string().min(1).describe('Match the OpenTelemetry severity text exactly.').optional(),
      body_contains: z
        .string()
        .min(1)
        .describe(
          'Match records whose rendered `message` contains this case-sensitive\nsubstring.\n\nRecords with a structured body are matched against their JSON\nrendering, so the substring meets JSON syntax rather than prose: a\nbare key name such as `operation` matches every record carrying that\nkey, and `http_status: 200` matches none, because the rendering\ncontains `"http_status":200` with no space.\n',
        )
        .optional(),
      trace_id: z
        .string()
        .regex(new RegExp('^[0-9a-f]{32}$'))
        .describe(
          'Match records associated with this OpenTelemetry trace ID. W3C Trace\nContext defines a trace ID as 32 lowercase hex digits, and that is\nwhat is stored, so an uppercase value is rejected rather than\nsilently matching nothing.\n',
        )
        .optional(),
      logql: z
        .string()
        .min(1)
        .describe(
          "Escape hatch for selections the structured filters cannot express: a\nraw LogQL expression, evaluated against this branch's log stream.\n\nOnly stream selectors and line filters are accepted — no\naggregations and no parser stages. Supplying this alongside any\nstructured filter is rejected with `conflicting_filters` rather than\nsilently ignoring one of them. `limit`, `sort_order`, and the time\nwindow still apply.\n\nThis field passes the underlying query language through to the\ncaller, so unlike the rest of this contract it may change as that\nbackend changes. Prefer the structured filters where they suffice.\n",
        )
        .optional(),
    }),
  })
  .refine(input => input.body.since === undefined || input.body.start_time === undefined, {
    message: 'Use either since or start_time, not both',
    path: ['body'],
  })
  .refine(
    input =>
      input.body.start_time === undefined ||
      input.body.end_time === undefined ||
      Date.parse(input.body.start_time) < Date.parse(input.body.end_time),
    { message: 'start_time must precede end_time', path: ['body', 'end_time'] },
  )
  .refine(
    input =>
      input.body.logql === undefined ||
      [
        input.body.source,
        input.body.service_name,
        input.body.scope_name,
        input.body.minimum_severity,
        input.body.severity_text,
        input.body.body_contains,
        input.body.trace_id,
      ].every(value => value === undefined),
    { message: 'logql cannot be combined with structured filters', path: ['body', 'logql'] },
  );

const ProviderResponseSchema = z
  .object({
    logs: z.array(
      z
        .object({
          timestamp: z.string(),
          message: z.string(),
          source: z.enum(['function', 'storage', 'pg_endpoint']).optional(),
          entity_id: z.string().optional(),
          service_name: z.string().optional(),
          scope_name: z.string().optional(),
          severity_number: z.number().int().min(0).max(24).optional(),
          severity_text: z.string().optional(),
          trace_id: z.string().optional(),
          span_id: z.string().optional(),
          attributes: z.object({}).passthrough(),
        })
        .passthrough(),
    ),
    next_cursor: z.string().optional(),
    is_truncated: z.boolean(),
  })
  .passthrough();

export const queryBranchLogsOutputSchema = ProviderResponseSchema;

export function queryBranchLogsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'neon_query_branch_logs',
    description:
      'Query branch logs. Returns logs emitted by services running on the specified branch,\nordered by timestamp according to `sort_order`.\n\nAll supplied filters are combined with `AND`: a record is returned only\nwhen it matches every filter. `minimum_severity` and `severity_text` are\nindependent filters, so setting both requires a record to clear the\nseverity floor *and* match the exact severity text.\n\nSupply `logql` instead of the structured filters to run a raw LogQL\nexpression. Combining it with any structured filter is rejected rather\nthan silently ignored; `limit`, `sort_order`, and the time window still\napply, because those bound the query rather than form part of the\nexpression.\n\nGive the window either as `since` — a duration ending at `end_time`, or\nat the current time when `end_time` is omitted — or as an explicit\n`start_time`. Supplying both is rejected.\n\nA single response holds at most 1,000 records. When `is_truncated` is\n`true`, pass the returned `next_cursor` back as `cursor` to fetch the\nnext page, repeating the time range and every filter unchanged.\n\nIf no time range is supplied, the query covers the previous hour. The\nmaximum supported time range is seven days. `end_time` is exclusive.\n\n**Note**: This endpoint is currently in Private Beta.\n',
    inputSchema: queryBranchLogsInputSchema,
    outputSchema: queryBranchLogsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof queryBranchLogsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/neondatabase/neon-pkgs/af5a839e5900dc98120af6261b5b29d02c74a8e1/packages/sdk/spec/neon-openapi.json,
        endpoint: `/v2/projects/${encodeURIComponent(input['project_id'])}/branches/${encodeURIComponent(input['branch_id'])}/logs/query`,
        retries: 0,
        data: input.body,
      };
      const response = await platformProxy.post(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
