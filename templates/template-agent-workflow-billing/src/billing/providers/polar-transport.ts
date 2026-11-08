import { z } from 'zod';
import { BillingError } from '../contracts.js';

export class WireError extends Error {
  constructor(readonly status: number) {
    super('Polar request failed.');
  }
}
export class PolarTransport {
  constructor(
    private readonly server: string,
    private readonly token: string,
  ) {}
  async request<T>(path: string, schema: z.ZodType<T>, body?: unknown): Promise<T> {
    const response = await fetch(`${this.server.replace(/\/$/, '')}/v1${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Polar-Version': '2026-10',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.headers.get('Polar-Version') !== '2026-10') throw new BillingError('state_unavailable');
    if (!response.ok) {
      await response.body?.cancel();
      throw new WireError(response.status);
    }
    const text = await response.text();
    if (Buffer.byteLength(text) > 4 * 1024 * 1024) throw new BillingError('state_unavailable');
    const parsed = schema.safeParse(JSON.parse(text));
    if (!parsed.success) throw new BillingError('state_unavailable');
    return parsed.data;
  }
  async list<T extends { id: string }>(path: string, schema: z.ZodType<T>, customerId: string): Promise<T[]> {
    const result: T[] = [];
    let count: number | undefined;
    let pages: number | undefined;
    for (let page = 1; page <= 100; page++) {
      const data = await this.request(
        `${path}?customer_id=${encodeURIComponent(customerId)}&page=${page}&limit=100`,
        z.object({
          items: z.array(schema).max(100),
          pagination: z.object({
            total_count: z.number().int().min(0).max(10000),
            max_page: z.number().int().min(0).max(100),
          }),
        }),
      );
      count ??= data.pagination.total_count;
      pages ??= data.pagination.max_page;
      if (count !== data.pagination.total_count || pages !== data.pagination.max_page || (count > 0 && pages === 0))
        throw new BillingError('state_unavailable');
      result.push(...data.items);
      if (page >= pages) {
        if (result.length !== count || new Set(result.map(value => value.id)).size !== result.length)
          throw new BillingError('state_unavailable');
        return result;
      }
    }
    throw new BillingError('state_unavailable');
  }
}
