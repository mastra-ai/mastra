import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { attioConfig } from '../src/mastra/config/attio';
import { AttioClient, entrySchema } from '../src/mastra/providers/attio/client';
import { attioMetadataSchema } from '../src/mastra/providers/attio/metadata';
import { OutputError } from '../src/mastra/providers/output';
import { exampleProfile } from '../tests/support/example-profile';

/** Bounded retry for observational GETs only; callers must never pass a mutation or research operation. */
export async function observeRead<T>(
  read: () => Promise<T>,
  limits: AttioClient['config']['limits'],
  deadline: number,
): Promise<T> {
  for (let attempt = 1; Date.now() < deadline; attempt++) {
    try {
      return await read();
    } catch (error) {
      const delay = error instanceof OutputError ? Math.max(limits.retryDelayMs, error.retryAfterMs) : 0;
      if (
        !(error instanceof OutputError) ||
        !error.retryable ||
        attempt >= limits.maxAttempts ||
        delay > limits.maxRetryDelayMs ||
        Date.now() + delay >= deadline
      )
        throw error;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Expected observation did not occur within the approved wait');
}
export async function observeAttioEntry(
  client: AttioClient,
  entryId: string,
  accept: (fields: Record<string, unknown>) => boolean,
  deadline: number,
  observe: (fields: Record<string, unknown>) => void = () => undefined,
  intervalMs = 1000,
) {
  while (Date.now() < deadline) {
    const fields = await observeRead(
      async () => client.fields(await client.entry(entryId)),
      client.config.limits,
      deadline,
    );
    observe(fields);
    if (accept(fields)) return fields;
    const delay = Math.min(intervalMs, deadline - Date.now());
    if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
  }
  throw new Error('Expected Attio transition did not occur within the approved wait');
}

export async function createDemoEntry(client: AttioClient, profile: ReturnType<typeof exampleProfile>) {
  const records = z
    .array(z.object({ id: z.object({ workspace_id: z.uuid(), object_id: z.uuid(), record_id: z.uuid() }) }))
    .max(2)
    .parse(
      await client.request(
        `objects/${client.config.companyObjectId}/records/query`,
        'POST',
        { filter: { domains: { $eq: profile.domain } }, limit: 2 },
        false,
      ),
    );
  if (
    records.length !== 1 ||
    records[0]!.id.workspace_id !== client.config.workspaceId ||
    records[0]!.id.object_id !== client.config.companyObjectId
  )
    throw new Error('The explicit domain must match exactly one existing company in the configured workspace');
  const fields = {
    stage: 'Triage',
    ...(client.config.layoutVersion === 2
      ? {
          metadata: JSON.stringify(
            attioMetadataSchema.parse({
              version: 2,
              input: profile.inquiry ? { inquiry: profile.inquiry } : {},
            }),
          ),
        }
      : {
          contactName: profile.contactName,
          contactEmail: profile.contactEmail,
          ...(profile.inquiry ? { inquiry: JSON.stringify(profile.inquiry) } : {}),
        }),
  };
  const entry_values = Object.fromEntries(
    Object.entries(fields).map(([name, value]) => {
      const key = name as keyof typeof client.config.fields;
      return [client.config.fields[key].slug, client.encode(key, value)];
    }),
  );
  const entry = entrySchema.parse(
    await client.request(`lists/${client.config.listId}/entries`, 'POST', {
      parent_object: client.config.companyObjectId,
      parent_record_id: records[0]!.id.record_id,
      entry_values,
    }),
  );
  if (entry.id.workspace_id !== client.config.workspaceId || entry.id.list_id !== client.config.listId)
    throw new Error('Created entry does not match the configured demo destination');
  return entry;
}
async function main() {
  const args = parseArgs({
    options: {
      domain: { type: 'string' },
      seed: { type: 'string', default: '42' },
      scenario: { type: 'string', default: 'recent-inquiry' },
    },
    strict: true,
  });
  const config = attioConfig();
  if (!config) throw new Error('Configure attio.mapping.json, ATTIO_API_TOKEN and ATTIO_WEBHOOK_SECRET first');
  const profile = exampleProfile({
    domain: args.values.domain!,
    seed: Number(args.values.seed),
    scenario: args.values.scenario as Parameters<typeof exampleProfile>[0]['scenario'],
  });
  const client = new AttioClient(config);
  const entry = await createDemoEntry(client, profile);
  let fields: Record<string, unknown> = {};
  let observationError: string | null = null;
  try {
    fields = await observeAttioEntry(
      client,
      entry.id.entry_id,
      fields => Boolean(fields.cycleId),
      Date.now() + 15_000,
      current => {
        fields = current;
      },
      500,
    );
  } catch (error) {
    observationError = error instanceof OutputError ? error.code : 'observation_deadline';
  }
  console.info(
    JSON.stringify({
      entryId: entry.id.entry_id,
      observationError,
      runId: fields.cycleId ?? null,
      scenario: profile.scenario,
      seed: profile.seed,
      route: fields.stage ?? 'Triage',
      status: fields.cycleId ? 'accepted' : 'waiting_for_webhook',
      note: 'Example contact details; research uses the supplied real company domain.',
    }),
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch(() => {
    console.error('Attio demo failed. Check the dedicated list mapping, existing company domain and API permissions.');
    process.exitCode = 1;
  });
