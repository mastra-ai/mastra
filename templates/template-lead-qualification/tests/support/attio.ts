import { randomUUID } from 'node:crypto';
import { vi } from 'vitest';
import { z } from 'zod';
import {
  attioConfigSchema,
  legacyAttioFieldNames,
  attioOptions,
  attioFields,
  compactAttioFieldNames,
} from '../../src/mastra/config/attio';
import type { AttioConfig } from '../../src/mastra/config/attio';
import { AttioClient } from '../../src/mastra/providers/attio/client';
import type { AttioEntry, AttioValue } from '../../src/mastra/providers/attio/client';

export function attioFixture(compact = false) {
  const fieldNames = compact ? compactAttioFieldNames : legacyAttioFieldNames;
  const config = attioConfigSchema.parse({
    ...(compact ? { layoutVersion: 2 } : {}),
    token: 'controlled-attio-token',
    webhookSecret: 'controlled-webhook-secret',
    workspaceId: randomUUID(),
    listId: randomUUID(),
    companyObjectId: randomUUID(),
    fields: Object.fromEntries(fieldNames.map(name => [name, { id: randomUUID(), slug: attioFields[name].slug }])),
    options: Object.fromEntries(
      Object.entries(attioOptions).map(([name, labels]) => [
        name,
        Object.fromEntries(labels.map(label => [label, randomUUID()])),
      ]),
    ),
    limits: { timeoutMs: 500, maxAttempts: 3, retryDelayMs: 30, maxRetryDelayMs: 2000 },
    sales: {
      listId: randomUUID(),
      stage: { id: randomUUID(), slug: 'sales_stage' },
      assessmentId: { id: randomUUID(), slug: 'assessment' },
      cycleId: { id: randomUUID(), slug: 'cycle' },
      wonOptionId: randomUUID(),
      lostOptionId: randomUUID(),
    },
  });
  let companyDomains = ['example.com'];
  const entries = new Map<string, AttioEntry>();
  const member = { type: 'workspace-member' as const, id: randomUUID() };
  const integration = { type: 'api-token' as const, id: randomUUID() };
  const system = { type: 'system' as const, id: null };
  let fail: { status?: number; after?: boolean; body?: boolean; remaining: number; retryAfter?: string } | undefined;
  const writes: Array<Record<string, unknown>> = [];
  const value = (
    name: keyof AttioConfig['fields'],
    input: unknown,
    actor: AttioValue['created_by_actor'] = integration,
    at = new Date().toISOString(),
  ): AttioValue => {
    const mapping = config.options[name as keyof AttioConfig['options']];
    return {
      active_from: at,
      active_until: null,
      created_by_actor: actor,
      attribute_type: mapping
        ? name === 'stage'
          ? 'status'
          : 'select'
        : typeof input === 'number'
          ? 'number'
          : 'text',
      ...(mapping
        ? name === 'stage'
          ? { status: { id: { status_id: mapping[String(input)]! } } }
          : { option: { id: { option_id: mapping[String(input)]! } } }
        : { value: ['evidenceLinks', 'gaps', 'reviewReasons'].includes(name) ? JSON.stringify(input) : input }),
    };
  };
  function set(
    entryId: string,
    name: keyof AttioConfig['fields'],
    input: unknown,
    actor: AttioValue['created_by_actor'] = member,
    at = new Date().toISOString(),
  ) {
    entries.get(entryId)!.entry_values[config.fields[name].slug] =
      input === undefined ? [] : [value(name, input, actor, at)];
  }
  function add(inquiry = true) {
    const id = randomUUID();
    const entry: AttioEntry = {
      id: { workspace_id: config.workspaceId, list_id: config.listId, entry_id: id },
      parent_object: config.companyObjectId,
      parent_record_id: randomUUID(),
      entry_values: {
        owner_note: [
          {
            active_from: new Date().toISOString(),
            active_until: null,
            created_by_actor: member,
            attribute_type: 'text',
            value: 'Keep this note',
          },
        ],
      },
    };
    entries.set(id, entry);
    set(id, 'stage', 'Triage');
    const submitted = {
      type: 'demo_request',
      occurredAt: new Date(Date.now() - 1000).toISOString(),
      text: 'Please demonstrate the product.',
    };
    if (compact) set(id, 'metadata', JSON.stringify({ version: 2, input: inquiry ? { inquiry: submitted } : {} }));
    else if (inquiry) set(id, 'inquiry', JSON.stringify(submitted));
    return id;
  }
  const transport = vi.fn<typeof fetch>(async (url, init) => {
    const parsed = new URL(url instanceof Request ? url.url : url.toString());
    if (parsed.origin !== 'https://api.attio.com') throw new Error('Unexpected Attio origin');
    if (fail?.remaining && !fail.after) {
      fail.remaining--;
      return new Response('{}', {
        status: fail.status ?? 503,
        headers: fail.retryAfter ? { 'retry-after': fail.retryAfter } : {},
      });
    }
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts[1] === 'objects')
      return Response.json({
        data: {
          id: { workspace_id: config.workspaceId, object_id: config.companyObjectId, record_id: parts[4] },
          values: {
            domains: companyDomains.map(domain => ({ ...value('summary', ''), domain, attribute_type: 'domain' })),
            name: [value('summary', 'Controlled Company', system)],
            description: [value('summary', 'System-enriched company description.', system)],
            employee_range: [
              {
                ...value('summary', '', system),
                attribute_type: 'select',
                option: { id: { option_id: randomUUID() } },
              },
            ],
          },
        },
      });
    const entry = entries.get(parts[4]!);
    if (!entry) return Response.json({}, { status: 404 });
    if (parts[5] === 'attributes') {
      const field =
        Object.values(config.fields).find(item => item.id === parts[6]) ??
        Object.values(config.sales!).find(item => typeof item === 'object' && item.id === parts[6]);
      const slug = (field as { slug?: string } | undefined)?.slug;
      return Response.json({ data: slug ? (entry.entry_values[slug] ?? []) : [] });
    }
    if (init?.method === 'PUT') {
      const body = JSON.parse(z.string().parse(init.body)).data.entry_values as Record<
        string,
        Array<{ value?: unknown; status?: string; option?: string }>
      >;
      writes.push(body);
      for (const [slug, values] of Object.entries(body)) {
        const name = fieldNames.find(key => config.fields[key].slug === slug)!;
        const input = values[0];
        if (!input) entry.entry_values[slug] = [];
        else if (input.status || input.option) {
          const mapping = config.options[name as keyof AttioConfig['options']];
          entry.entry_values[slug] = [
            value(
              name,
              Object.keys(mapping).find(label => mapping[label] === (input.status ?? input.option)),
            ),
          ];
        } else entry.entry_values[slug] = [{ ...value(name, ''), value: input.value }];
      }
      if (fail?.remaining && fail.after) {
        fail.remaining--;
        if (fail.body)
          return new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(new TextEncoder().encode('{"data":'));
              },
              pull(controller) {
                controller.error(new TypeError('Lost response body after write'));
              },
            }),
            { status: 200 },
          );
        throw new TypeError('Lost response after write');
      }
    }
    return Response.json({ data: entry });
  });
  const client = new AttioClient(config, transport);
  function event(
    entryId: string,
    attribute?: keyof AttioConfig['fields'],
    actor: AttioValue['created_by_actor'] = member,
  ) {
    return {
      event_type: attribute ? 'list-entry.updated' : 'list-entry.created',
      id: {
        workspace_id: config.workspaceId,
        list_id: config.listId,
        entry_id: entryId,
        ...(attribute ? { attribute_id: config.fields[attribute].id } : {}),
      },
      actor,
    };
  }
  return {
    config,
    entries,
    setDomains: (domains: string[]) => {
      companyDomains = domains;
    },
    member,
    integration,
    system,
    transport,
    client,
    writes,
    value,
    set,
    add,
    event,
    fault: (failure: typeof fail) => {
      fail = failure;
    },
  };
}
