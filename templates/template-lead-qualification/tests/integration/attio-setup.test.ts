import { mkdtemp, readFile, writeFile, readdir, rm, stat, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, expect, it } from 'vitest';
import { setupAttio } from '../../scripts/attio-setup';
import { attioFields, compactAttioFieldNames, attioMappingSchema } from '../../src/mastra/config/attio';
import { attioFixture } from '../support/attio';
import { setupFixture } from '../support/attio-setup';
const directories: string[] = [];
afterEach(async () => {
  for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true });
});
async function directory() {
  const root = await mkdtemp(join(tmpdir(), 'attio-setup-'));
  directories.push(root);
  return root;
}
const token = 'controlled-secret-never-in-mapping';
it('plans_and_applies_attio_setup_idempotently_without_exposing_secrets', async () => {
  const fixture = setupFixture();
  const root = await directory();
  const options = { token, root, transport: fixture.transport };
  const plan = await setupAttio({ listId: fixture.listId }, options);
  expect(plan.mode).toBe('plan');
  expect(plan.actions.filter(action => action.kind === 'create_attribute')).toHaveLength(compactAttioFieldNames.length);
  expect(fixture.mutationCount()).toBe(0);
  expect(await readdir(root)).toEqual([]);
  const applied = await setupAttio({ listId: fixture.listId, apply: true }, options);
  expect(applied.subscriptions).toHaveLength(2);
  const path = join(root, 'attio.mapping.json');
  const original = await readFile(path, 'utf8');
  const mapping = attioMappingSchema.parse(JSON.parse(original));
  expect(Object.keys(mapping.fields)).toHaveLength(4);
  expect(mapping.fields.reviewJustification.slug).toBe(attioFields.reviewJustification.slug);
  expect(original).not.toContain(token);
  expect(JSON.stringify(applied)).not.toContain(token);
  expect((await stat(path)).mode & 0o777).toBe(0o600);
  const mutations = fixture.mutationCount();
  await writeFile(path, JSON.stringify(mapping));
  const repeated = await setupAttio({ listId: fixture.listId, apply: true }, options);
  expect(repeated.actions).toEqual([]);
  expect(fixture.mutationCount()).toBe(mutations);
  expect(await readFile(`${path}.bak`, 'utf8')).toBe(JSON.stringify(mapping));
  expect(await readFile(path, 'utf8')).toBe(original);
  expect((await stat(`${path}.bak`)).mode & 0o777).toBe(0o600);
});
it('resumes_partial_setup_without_duplicate_resources_or_implicit_lists', async () => {
  const fixture = setupFixture();
  const root = await directory();
  fixture.lists.splice(0);
  const options = { token, root, transport: fixture.transport };
  await expect(setupAttio({}, options)).rejects.toThrow('Choose');
  const input = { newList: { name: 'Lead Qualification Demo', slug: 'lead_qualification_demo' }, apply: true };
  fixture.failAfter(6);
  await expect(setupAttio(input, options)).rejects.toThrow('attio_http_503');
  expect(await readdir(root)).toEqual([]);
  expect(fixture.attributes.length).toBeGreaterThan(0);
  await setupAttio(input, options);
  expect(fixture.lists).toHaveLength(1);
  expect(fixture.attributes).toHaveLength(4);
  expect(new Set(fixture.attributes.map(attribute => attribute.api_slug)).size).toBe(4);
  const before = fixture.mutationCount();
  await setupAttio(input, options);
  expect(fixture.mutationCount()).toBe(before);
});
it('preserves_mapping_and_crm_resources_when_setup_is_incompatible_or_work_is_pending', async () => {
  const fixture = setupFixture();
  const root = await directory();
  const options = { token, root, transport: fixture.transport };
  await setupAttio({ listId: fixture.listId, apply: true }, options);
  const path = join(root, 'attio.mapping.json');
  const original = await readFile(path, 'utf8');
  const mutations = fixture.mutationCount();
  const attribute = fixture.attributes.find(item => item.api_slug === attioFields.metadata.slug)!;
  attribute.type = 'number';
  await expect(setupAttio({ listId: fixture.listId, apply: true }, options)).rejects.toThrow('Incompatible metadata');
  expect(await readFile(path, 'utf8')).toBe(original);
  expect(fixture.mutationCount()).toBe(mutations);
  attribute.type = 'text';
  fixture.attributes.push({
    ...attribute,
    id: { ...attribute.id, attribute_id: crypto.randomUUID() },
    api_slug: 'ambiguous_metadata',
  });
  await expect(setupAttio({ listId: fixture.listId, apply: true }, options)).rejects.toThrow('Ambiguous metadata');
  fixture.attributes.pop();
  await mkdir(join(root, 'data'));
  const db = new DatabaseSync(join(root, 'data/application.db'));
  db.exec(
    "CREATE TABLE lead_cycles(destination_provider TEXT,active INTEGER);INSERT INTO lead_cycles VALUES('attio',1)",
  );
  db.close();
  await expect(setupAttio({ listId: fixture.listId, apply: true }, options)).rejects.toThrow('Stop intake');
  expect(await readFile(path, 'utf8')).toBe(original);
  expect(fixture.mutationCount()).toBe(mutations);
  const unsafe = async () => Response.json({ message: `private response ${token}` }, { status: 403 });
  await expect(setupAttio({ listId: fixture.listId }, { ...options, transport: unsafe })).rejects.toThrow(
    'attio_http_403',
  );
});

it('retains_a_deployed_legacy_layout_without_converting_fields_or_mapping_ids', async () => {
  const fixture = setupFixture();
  const { token: _token, webhookSecret: _secret, sales: _sales, ...legacy } = attioFixture().config;
  const mapping = {
    ...legacy,
    workspaceId: fixture.workspaceId,
    listId: fixture.listId,
    companyObjectId: fixture.companyId,
  };
  for (const [name, field] of Object.entries(mapping.fields)) {
    const definition = attioFields[name as keyof typeof attioFields];
    fixture.attributes.push({
      id: { workspace_id: fixture.workspaceId, list_id: fixture.listId, attribute_id: field.id },
      title: name === 'stage' ? 'Qualification stage' : definition.title,
      api_slug: field.slug,
      type: definition.type,
      is_archived: false,
      is_multiselect: false,
      is_required: false,
      is_unique: false,
    });
    const options = mapping.options[name as keyof typeof mapping.options];
    if (options)
      fixture.choices.set(
        field.id,
        Object.entries(options).map(([title, id]) => ({
          id: {
            workspace_id: fixture.workspaceId,
            attribute_id: field.id,
            ...(name === 'stage' ? { status_id: id } : { option_id: id }),
          },
          title,
          is_archived: false,
        })),
      );
  }
  const root = await directory();
  const path = join(root, 'attio.mapping.json');
  await writeFile(path, JSON.stringify(mapping));
  const result = await setupAttio(
    { listId: fixture.listId, apply: true },
    { token, root, transport: fixture.transport },
  );
  expect(result.actions).toEqual([]);
  expect(fixture.mutationCount()).toBe(0);
  expect(fixture.attributes).toHaveLength(21);
  expect(JSON.parse(await readFile(path, 'utf8'))).toEqual(mapping);
  expect(fixture.attributes.find(item => item.api_slug === mapping.fields.stage.slug)!.title).toBe(
    'Qualification stage',
  );
});
