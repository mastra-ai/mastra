import { existsSync } from 'node:fs';
import { readFile, rename, writeFile, rm, chmod } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import { AttioApi } from '../src/mastra/providers/attio/client';
import { OutputError } from '../src/mastra/providers/output';
import {
  attioFields,
  legacyAttioFieldNames,
  compactAttioFieldNames,
  attioOptions,
  attioMappingSchema,
} from '../src/mastra/config/attio';
import type { AttioMapping } from '../src/mastra/config/attio';
import { resolveProjectRoot } from '../src/mastra/config/runtime';

class SetupError extends Error {}
const slug = z.string().regex(/^[a-z][a-z0-9_]{0,99}$/);
export const setupInputSchema = z
  .strictObject({
    listId: z.uuid().optional(),
    newList: z.strictObject({ name: z.string().trim().min(1).max(100), slug }).optional(),
    apply: z.boolean().default(false),
  })
  .refine(input => Boolean(input.listId) !== Boolean(input.newList), 'Choose --list-id or --new-list with --list-slug');
const listSchema = z.object({
  id: z.object({ workspace_id: z.uuid(), list_id: z.uuid() }),
  name: z.string(),
  api_slug: z.string(),
  parent_object: z.array(z.string()),
});
const attributeSchema = z.object({
  id: z.object({ workspace_id: z.uuid(), attribute_id: z.uuid(), list_id: z.uuid().optional() }),
  title: z.string(),
  api_slug: z.string(),
  type: z.string(),
  is_archived: z.boolean(),
  is_multiselect: z.boolean(),
  is_required: z.boolean(),
  is_unique: z.boolean(),
});
const optionSchema = z.object({
  id: z.object({
    workspace_id: z.uuid(),
    attribute_id: z.uuid(),
    option_id: z.uuid().optional(),
    status_id: z.uuid().optional(),
  }),
  title: z.string(),
  is_archived: z.boolean().optional(),
});
type Attribute = z.infer<typeof attributeSchema>;
type Option = z.infer<typeof optionSchema>;
type Field = keyof typeof attioFields;
type Action = { kind: 'create_list' | 'create_attribute' | 'create_option'; field?: Field; label?: string };
const unique = <T>(items: T[], description: string) => {
  if (items.length > 1) throw new SetupError(`Ambiguous ${description}; resolve it before applying setup`);
  return items[0];
};

function assertNoPending(root: string) {
  const path = resolve(root, 'data/application.db');
  if (!existsSync(path)) return;
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const tables = new Set(
      (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>).map(
        row => row.name,
      ),
    );
    const active =
      tables.has('lead_cycles') &&
      db.prepare("SELECT 1 FROM lead_cycles WHERE destination_provider='attio' AND active=1 LIMIT 1").get();
    const inbox =
      tables.has('lead_attio_events') &&
      db.prepare("SELECT 1 FROM lead_attio_events WHERE state='pending' LIMIT 1").get();
    const operations =
      tables.has('lead_output_operations') &&
      db
        .prepare(
          "SELECT 1 FROM lead_output_operations o JOIN lead_cycles c ON c.run_id=o.run_id WHERE c.destination_provider='attio' AND o.state<>'applied' LIMIT 1",
        )
        .get();
    if (active || inbox || operations)
      throw new SetupError(
        'Stop intake and reconcile active Attio reviews, pending inbox events and output operations before setup',
      );
  } finally {
    db.close();
  }
}
export function attioSubscriptions(mapping: Pick<AttioMapping, 'listId' | 'fields'>) {
  const list = { field: 'id.list_id', operator: 'equals', value: mapping.listId };
  return [
    { event_type: 'list-entry.created', filter: { $and: [list] } },
    {
      event_type: 'list-entry.updated',
      filter: { $and: [list, { field: 'id.attribute_id', operator: 'equals', value: mapping.fields.stage.id }] },
    },
  ];
}
/** Discovery is read-only by default. Applying resumes missing resources, never rewrites existing attributes. */
export async function setupAttio(
  input: z.input<typeof setupInputSchema>,
  options: { token: string; root?: string; transport?: typeof fetch },
) {
  const request = setupInputSchema.parse(input);
  const root = options.root ?? resolveProjectRoot();
  const path = resolve(root, 'attio.mapping.json');
  const original = existsSync(path) ? await readFile(path, 'utf8') : null;
  const previous = original === null ? undefined : attioMappingSchema.parse(JSON.parse(original));
  const api = new AttioApi(z.string().min(1).parse(options.token), 10_000, options.transport);
  const identity = z.object({ active: z.literal(true), workspace_id: z.uuid() }).parse(await api.request('self'));
  const objects = z
    .array(z.object({ id: z.object({ workspace_id: z.uuid(), object_id: z.uuid() }), api_slug: z.string() }))
    .max(500)
    .parse(await api.request('objects'));
  const company = unique(
    objects.filter(object => object.api_slug === 'companies' && object.id.workspace_id === identity.workspace_id),
    'companies object',
  );
  if (!company) throw new SetupError('The workspace needs a companies object');
  const lists = z
    .array(listSchema)
    .max(500)
    .parse(await api.request('lists'));
  const matches = lists.filter(list =>
    request.listId ? list.id.list_id === request.listId : list.api_slug === request.newList!.slug,
  );
  let list = unique(matches, 'qualification list');
  if (!list && request.listId) throw new SetupError('Selected qualification list was not found');
  if (
    list &&
    (list.id.workspace_id !== identity.workspace_id ||
      !list.parent_object.every(parent => [company.id.object_id, 'companies'].includes(parent)) ||
      !list.parent_object.length)
  )
    throw new SetupError('Selected list must have only company parents in this workspace');
  if (list && request.newList && list.name !== request.newList.name)
    throw new SetupError('List slug belongs to a different named list');
  if (previous && previous.workspaceId !== identity.workspace_id)
    throw new SetupError('Existing mapping belongs to another workspace');
  const reuse = previous?.listId === list?.id.list_id ? previous : undefined;
  const fieldNames = reuse && reuse.layoutVersion !== 2 ? legacyAttioFieldNames : compactAttioFieldNames;
  const attributes = list
    ? z
        .array(attributeSchema)
        .max(500)
        .parse(await api.request(`lists/${list.id.list_id}/attributes`))
    : [];
  const planned = new Map<Field, { attribute?: Attribute; options: Option[] }>();
  const actions: Action[] = [];
  if (!list) actions.push({ kind: 'create_list' });
  for (const field of fieldNames) {
    const definition = attioFields[field];
    const saved = reuse?.fields[field];
    const candidates = attributes.filter(
      attribute =>
        attribute.id.attribute_id === saved?.id ||
        attribute.api_slug === definition.slug ||
        attribute.title === definition.title,
    );
    const attribute = unique(candidates, `${field} attribute`);
    if (
      attribute &&
      (attribute.id.workspace_id !== identity.workspace_id ||
        (attribute.id.list_id && attribute.id.list_id !== list!.id.list_id) ||
        attribute.type !== definition.type ||
        attribute.is_archived ||
        attribute.is_multiselect ||
        attribute.is_required ||
        attribute.is_unique)
    )
      throw new SetupError(`Incompatible ${field} attribute; no existing attribute was modified`);
    if (saved && !attribute) throw new SetupError(`Previously mapped ${field} attribute is missing`);
    if (!attribute) actions.push({ kind: 'create_attribute', field });
    const labels = attioOptions[field as keyof typeof attioOptions];
    const choices =
      attribute && labels
        ? z
            .array(optionSchema)
            .max(500)
            .parse(
              await api.request(
                `lists/${list!.id.list_id}/attributes/${attribute.id.attribute_id}/${definition.type === 'status' ? 'statuses' : 'options'}`,
              ),
            )
        : [];
    for (const label of labels ?? []) {
      const savedId = reuse?.options[field as keyof typeof attioOptions]?.[label];
      const choice = unique(
        choices.filter(
          option =>
            !option.is_archived &&
            ((savedId !== undefined && (option.id.option_id === savedId || option.id.status_id === savedId)) ||
              option.title === label),
        ),
        `${field} ${label} option`,
      );
      if (
        choice &&
        (choice.id.workspace_id !== identity.workspace_id ||
          choice.id.attribute_id !== attribute!.id.attribute_id ||
          !(definition.type === 'status' ? choice.id.status_id : choice.id.option_id))
      )
        throw new SetupError(`Incompatible ${field} option`);
      if (savedId && !choice) throw new SetupError(`Previously mapped ${field} option is missing or archived`);
      if (!choice) actions.push({ kind: 'create_option', field, label });
    }
    planned.set(field, { attribute, options: choices });
  }
  if (!request.apply)
    return {
      mode: 'plan' as const,
      workspaceId: identity.workspace_id,
      listId: list?.id.list_id ?? null,
      actions,
      subscriptions: list && previous?.listId === list.id.list_id ? attioSubscriptions(previous) : null,
    };
  assertNoPending(root);
  if (!list)
    list = listSchema.parse(
      await api.request('lists', 'POST', {
        name: request.newList!.name,
        api_slug: request.newList!.slug,
        parent_object: company.id.object_id,
        workspace_access: 'full-access',
        workspace_member_access: [],
      }),
    );
  if (
    list.id.workspace_id !== identity.workspace_id ||
    (request.newList !== undefined && (list.name !== request.newList.name || list.api_slug !== request.newList.slug)) ||
    !list.parent_object.length ||
    !list.parent_object.every(parent => [company.id.object_id, 'companies'].includes(parent))
  )
    throw new SetupError('Created list did not match the selected workspace/company');
  const fields: Partial<AttioMapping['fields']> = {};
  const selections: AttioMapping['options'] = {
    stage: {},
    classification: {},
    reviewStatus: {},
    decisionSource: {},
    outputState: {},
  };
  for (const field of fieldNames) {
    const definition = attioFields[field];
    const plan = planned.get(field)!;
    const attribute =
      plan.attribute ??
      attributeSchema.parse(
        await api.request(`lists/${list.id.list_id}/attributes`, 'POST', {
          title: definition.title,
          description: `Lead qualification ${definition.title.toLowerCase()}.`,
          api_slug: definition.slug,
          type: definition.type,
          is_required: false,
          is_unique: false,
          is_multiselect: false,
          config: {},
        }),
      );
    if (
      attribute.id.workspace_id !== identity.workspace_id ||
      attribute.type !== definition.type ||
      attribute.is_archived ||
      attribute.is_multiselect ||
      attribute.is_required ||
      attribute.is_unique
    )
      throw new SetupError(`Created ${field} attribute did not match its definition`);
    fields[field] = { id: attribute.id.attribute_id, slug: attribute.api_slug };
    const labels = attioOptions[field as keyof typeof attioOptions];
    if (!labels) continue;
    const mapping: Record<string, string> = {};
    for (const label of labels) {
      const savedId = reuse?.options[field as keyof typeof attioOptions]?.[label];
      const choice =
        unique(
          plan.options.filter(
            option =>
              !option.is_archived &&
              ((savedId !== undefined && (option.id.option_id === savedId || option.id.status_id === savedId)) ||
                option.title === label),
          ),
          `${field} option`,
        ) ??
        optionSchema.parse(
          await api.request(
            `lists/${list.id.list_id}/attributes/${attribute.id.attribute_id}/${definition.type === 'status' ? 'statuses' : 'options'}`,
            'POST',
            { title: label, ...(definition.type === 'status' ? { celebration_enabled: false } : {}) },
          ),
        );
      if (
        choice.id.workspace_id !== identity.workspace_id ||
        choice.id.attribute_id !== attribute.id.attribute_id ||
        choice.is_archived
      )
        throw new SetupError(`Created ${field} option did not match its attribute`);
      mapping[label] = z.uuid().parse(definition.type === 'status' ? choice.id.status_id : choice.id.option_id);
    }
    selections[field as keyof typeof attioOptions] = mapping;
  }
  const mapping = attioMappingSchema.parse({
    ...(reuse && reuse.layoutVersion !== 2 ? {} : { layoutVersion: 2 }),
    workspaceId: identity.workspace_id,
    listId: list.id.list_id,
    companyObjectId: company.id.object_id,
    fields,
    options: selections,
    limits: previous?.limits ?? { timeoutMs: 10_000, maxAttempts: 3, retryDelayMs: 1000, maxRetryDelayMs: 3_600_000 },
    ...(previous?.sales ? { sales: previous.sales } : {}),
  });
  assertNoPending(root);
  const current = existsSync(path) ? await readFile(path, 'utf8') : null;
  if (current !== original) throw new SetupError('Mapping changed during setup; the existing file was preserved');
  const contents = `${JSON.stringify(mapping, null, 2)}\n`;
  if (current !== contents) {
    const temporary = `${path}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, contents, { mode: 0o600, flag: 'wx', flush: true });
      if (original !== null) {
        await writeFile(`${path}.bak`, original, { mode: 0o600, flush: true });
        await chmod(`${path}.bak`, 0o600);
      }
      await rename(temporary, path);
    } finally {
      await rm(temporary, { force: true });
    }
  }
  return {
    mode: 'applied' as const,
    workspaceId: mapping.workspaceId,
    listId: mapping.listId,
    actions,
    subscriptions: attioSubscriptions(mapping),
  };
}
async function main() {
  const { values } = parseArgs({
    options: {
      'list-id': { type: 'string' },
      'new-list': { type: 'string' },
      'list-slug': { type: 'string' },
      apply: { type: 'boolean', default: false },
    },
    strict: true,
  });
  if (values['list-slug'] && !values['new-list']) throw new SetupError('--list-slug requires --new-list');
  const result = await setupAttio(
    {
      listId: values['list-id'],
      ...(values['new-list'] ? { newList: { name: values['new-list'], slug: values['list-slug']! } } : {}),
      apply: values.apply,
    },
    { token: process.env.ATTIO_API_TOKEN ?? '' },
  );
  console.info(JSON.stringify(result, null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch(error => {
    console.error(
      error instanceof OutputError
        ? `Attio setup failed: ${error.code}`
        : error instanceof SetupError
          ? `Attio setup failed: ${error.message}`
          : 'Attio setup failed. Check the explicit list selection, compatible attributes/options, pending work and token permissions. Existing mapping was preserved.',
    );
    process.exitCode = 1;
  });
