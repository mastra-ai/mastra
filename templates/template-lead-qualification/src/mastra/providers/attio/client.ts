import { z } from 'zod';
import type { AttioConnectionConfig } from '../../config/attio';
import { parseAttioMetadata } from './metadata';
import { OutputError } from '../output';

export const actorSchema = z.discriminatedUnion('type', [
  z.object({ type: z.enum(['workspace-member', 'api-token']), id: z.uuid() }),
  z.object({ type: z.literal('system'), id: z.null() }),
]);
export const attioValueSchema = z.object({
  active_from: z.iso.datetime({ offset: true }),
  active_until: z.string().nullable(),
  created_by_actor: actorSchema,
  attribute_type: z.string(),
  value: z.unknown().optional(),
  status: z.object({ id: z.object({ status_id: z.uuid() }) }).optional(),
  option: z.object({ id: z.object({ option_id: z.uuid() }) }).optional(),
  domain: z.string().optional(),
  email_address: z.string().optional(),
});
export type AttioValue = z.infer<typeof attioValueSchema>;
const valuesSchema = z.record(z.string(), z.array(attioValueSchema));
export const entrySchema = z.object({
  id: z.object({ workspace_id: z.uuid(), list_id: z.uuid(), entry_id: z.uuid() }),
  parent_object: z.string(),
  parent_record_id: z.uuid(),
  entry_values: valuesSchema,
});
export type AttioEntry = z.infer<typeof entrySchema>;
const jsonFields = new Set(['evidenceLinks', 'gaps', 'reviewReasons']);
const numbers = new Set(['score', 'reviewRevision']);
export class AttioApi {
  constructor(
    private readonly token: string,
    private readonly timeoutMs: number,
    private readonly transport: typeof fetch = globalThis.fetch,
  ) {}
  async request(path: string, method = 'GET', data?: unknown, envelope = true): Promise<unknown> {
    let response: Response;
    try {
      response = await this.transport(`https://api.attio.com/v2/${path}`, {
        method,
        redirect: 'error',
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
        ...(data === undefined ? {} : { body: JSON.stringify(envelope ? { data } : data) }),
      });
    } catch {
      throw new OutputError('attio_unavailable', true);
    }
    if (!response.ok) {
      const retry = response.headers.get('retry-after');
      const delay = retry ? (/^\d+(\.\d+)?$/.test(retry) ? Number(retry) * 1000 : Date.parse(retry) - Date.now()) : 0;
      throw new OutputError(
        `attio_http_${response.status}`,
        response.status === 429 || response.status >= 500,
        Math.max(0, Number.isFinite(delay) ? delay : 0),
      );
    }
    const reader = response.body?.getReader();
    if (!reader) throw new OutputError('attio_invalid_response', false);
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.length;
        if (bytes > 12 * 1024 * 1024) {
          await reader.cancel();
          throw new OutputError('attio_response_too_large', false);
        }
        chunks.push(value);
      }
      const payload = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { data: unknown };
      return path === 'self' ? payload : payload.data;
    } catch (error) {
      if (error instanceof OutputError) throw error;
      throw new OutputError('attio_invalid_response', false);
    } finally {
      reader.releaseLock();
    }
  }
}
export class AttioClient extends AttioApi {
  constructor(
    readonly config: AttioConnectionConfig,
    transport: typeof fetch = globalThis.fetch,
  ) {
    super(config.token, config.limits.timeoutMs, transport);
  }
  async entry(entryId: string, listId = this.config.listId) {
    const entry = entrySchema.parse(await this.request(`lists/${listId}/entries/${z.uuid().parse(entryId)}`));
    if (
      entry.id.workspace_id !== this.config.workspaceId ||
      entry.id.list_id !== listId ||
      entry.id.entry_id !== entryId
    )
      throw new OutputError('attio_destination_conflict', false);
    return entry;
  }
  async history(entryId: string, attributeId: string, listId = this.config.listId) {
    return z
      .array(attioValueSchema)
      .max(500)
      .parse(await this.request(`lists/${listId}/entries/${entryId}/attributes/${attributeId}/values?limit=500`));
  }
  async company(recordId: string) {
    const record = z
      .object({
        id: z.object({ workspace_id: z.uuid(), object_id: z.uuid(), record_id: z.uuid() }),
        values: valuesSchema,
      })
      .parse(await this.request(`objects/${this.config.companyObjectId}/records/${recordId}`));
    if (
      record.id.workspace_id !== this.config.workspaceId ||
      record.id.object_id !== this.config.companyObjectId ||
      record.id.record_id !== recordId
    )
      throw new OutputError('attio_company_conflict', false);
    return record;
  }
  value(entry: AttioEntry, name: keyof AttioConnectionConfig['fields']) {
    const field = this.config.fields[name];
    if (!field) return undefined;
    const active = (entry.entry_values[field.slug] ?? entry.entry_values[field.id] ?? []).filter(
      value => value.active_until === null,
    );
    if (active.length > 1) throw new OutputError('attio_ambiguous_attribute', false);
    return active[0];
  }
  decode(name: keyof AttioConnectionConfig['fields'], value?: AttioValue): unknown {
    if (!value) return undefined;
    const mapping = this.config.options[name as keyof AttioConnectionConfig['options']];
    if (mapping) {
      const id = name === 'stage' ? value.status?.id.status_id : value.option?.id.option_id;
      const result = Object.keys(mapping).find(key => mapping[key] === id);
      if (!result) throw new OutputError('attio_unknown_option', false);
      return result;
    }
    if (jsonFields.has(name)) {
      const text = z.string().parse(value.value);
      return text.trimStart().startsWith('[') ? (JSON.parse(text) as unknown) : text;
    }
    return numbers.has(name) ? z.number().parse(value.value) : z.string().parse(value.value);
  }
  fields(entry: AttioEntry) {
    const fields: Record<string, unknown> = {};
    for (const name of Object.keys(this.config.fields) as Array<keyof AttioConnectionConfig['fields']>) {
      const value = this.decode(name, this.value(entry, name));
      if (value !== undefined) fields[name] = value;
    }
    if (this.config.layoutVersion === 2 && fields.metadata !== undefined) {
      const metadata = parseAttioMetadata(fields.metadata);
      Object.assign(fields, metadata.output ?? {});
    }
    if (fields.assessmentId)
      for (const name of ['reviewId', 'reviewRevision', 'decisionSource', 'reviewJustification', 'appliedAssessmentId'])
        fields[name] ??= null;
    return fields;
  }
  encode(name: keyof AttioConnectionConfig['fields'], value: unknown) {
    if (value === null || value === undefined) return [];
    const mapping = this.config.options[name as keyof AttioConnectionConfig['options']];
    if (mapping) {
      const id = mapping[z.string().parse(value)];
      if (!id) throw new OutputError('attio_unmapped_option', false);
      return [name === 'stage' ? { status: id } : { option: id }];
    }
    return [{ value: jsonFields.has(name) && typeof value !== 'string' ? JSON.stringify(value) : value }];
  }
  async update(entryId: string, fields: Record<string, unknown>) {
    const entry_values = Object.fromEntries(
      Object.entries(fields).map(([name, value]) => {
        const key = name as keyof AttioConnectionConfig['fields'];
        if (!this.config.fields[key]) throw new OutputError('attio_unowned_field', false);
        return [this.config.fields[key].slug, this.encode(key, value)];
      }),
    );
    await this.request(`lists/${this.config.listId}/entries/${entryId}`, 'PUT', { entry_values });
  }
}
