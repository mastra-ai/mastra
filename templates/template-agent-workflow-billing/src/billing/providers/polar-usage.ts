import { z } from 'zod';
import {
  BillingError,
  accountSchema,
  identifierSchema,
  quantitySchema,
  timestampSchema,
  parseInput,
  usageEventSchema,
} from '../contracts.js';
import type { UsageBinding, UsageEvent, UsageDelivery } from '../contracts.js';
import { polarConfigurationSchema } from './polar-contract.js';
import type { PolarBindings } from './polar-contract.js';
import { PolarTransport, WireError } from './polar-transport.js';

const polarUsageBindingSchema = z.strictObject({
  server: polarConfigurationSchema.shape.server,
  organizationId: z.uuid(),
  eventName: z.string().min(1).max(128),
  unitsField: z
    .string()
    .regex(/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/)
    .refine(value => !['execution_id', 'policy_version', 'resourceId', 'resourceKind'].includes(value)),
});

const usageDeliveryClaimSchema = z
  .strictObject({
    version: z.literal(1),
    event: usageEventSchema,
    request: z.strictObject({
      events: z.tuple([
        z.strictObject({
          name: z.string().min(1).max(128),
          external_id: identifierSchema,
          external_customer_id: accountSchema.shape.externalReference,
          timestamp: timestampSchema,
          metadata: z.record(
            z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/),
            z.union([z.string().max(128), quantitySchema]),
          ),
        }),
      ]),
    }),
  })
  .superRefine((claim, context) => {
    const wire = claim.request.events[0];
    const expected = {
      execution_id: claim.event.executionId,
      policy_version: claim.event.policyVersion,
      ...claim.event.metadata,
    };
    const unitFields = Object.keys(wire.metadata).filter(key => !Object.hasOwn(expected, key));
    if (
      wire.external_id !== claim.event.id ||
      wire.external_customer_id !== claim.event.account.externalReference ||
      wire.timestamp !== claim.event.occurredAt ||
      Object.entries(expected).some(([key, value]) => wire.metadata[key] !== value) ||
      unitFields.length !== 1 ||
      wire.metadata[unitFields[0]] !== claim.event.units
    )
      context.addIssue({ code: 'custom', message: 'Usage delivery must preserve its logical event.' });
  });

export class PolarUsage {
  private readonly id = 'polar';
  constructor(
    private readonly configuration: PolarBindings,
    private readonly transport: PolarTransport,
  ) {}
  bindUsage(meter: string): UsageBinding {
    const mapping = this.configuration.meters.find(value => value.key === meter);
    if (!mapping) throw new BillingError('invalid_input');
    const data = parseInput(polarUsageBindingSchema, {
      server: this.configuration.server,
      organizationId: this.configuration.organizationId,
      eventName: mapping.eventName,
      unitsField: mapping.unitsField,
    });
    return { provider: this.id, meter, version: 1, data: JSON.stringify(data) };
  }

  private usageMapping(binding: UsageBinding) {
    if (binding.provider !== this.id || binding.version !== 1) throw new BillingError('storage_incompatible');
    const mapping = parseInput(polarUsageBindingSchema, JSON.parse(binding.data));
    if (mapping.server !== this.configuration.server || mapping.organizationId !== this.configuration.organizationId)
      throw new BillingError('state_unavailable');
    return mapping;
  }
  normalizeUsage(input: UsageEvent, binding: UsageBinding): string {
    const event = parseInput(usageEventSchema, input);
    const mapping = this.usageMapping(binding);
    return JSON.stringify(
      usageDeliveryClaimSchema.parse({
        version: 1,
        event,
        request: {
          events: [
            {
              name: mapping.eventName,
              external_id: event.id,
              external_customer_id: event.account.externalReference,
              timestamp: event.occurredAt,
              metadata: {
                [mapping.unitsField]: event.units,
                execution_id: event.executionId,
                policy_version: event.policyVersion,
                ...Object.fromEntries(Object.entries(event.metadata).filter(([, value]) => value !== undefined)),
              },
            },
          ],
        },
      }),
    );
  }
  validateUsage(payload: string, input: UsageEvent, binding: UsageBinding | null): void {
    const event = parseInput(usageEventSchema, input);
    const claim = usageDeliveryClaimSchema.safeParse(JSON.parse(payload));
    if (!claim.success) throw new BillingError('storage_incompatible');
    if (JSON.stringify(claim.data.event) !== JSON.stringify(event)) throw new BillingError('conflict');
    if (binding) {
      const mapping = this.usageMapping(binding);
      const wire = claim.data.request.events[0];
      if (wire.name !== mapping.eventName || wire.metadata[mapping.unitsField] !== event.units)
        throw new BillingError('conflict');
    }
  }
  async sendUsage(payload: string): Promise<UsageDelivery> {
    const claim = usageDeliveryClaimSchema.parse(JSON.parse(payload));
    try {
      const result = await this.transport.request(
        '/events/ingest',
        z
          .object({
            inserted: z.number().int().min(0).max(1),
            duplicates: z.number().int().min(0).max(1).default(0),
          })
          .refine(value => value.inserted + value.duplicates === 1),
        claim.request,
      );
      return { status: result.duplicates === 1 ? 'duplicate' : 'accepted', eventId: claim.event.id };
    } catch (error) {
      return error instanceof WireError &&
        error.status >= 400 &&
        error.status < 500 &&
        ![408, 409, 429].includes(error.status)
        ? { status: 'permanent_failure', code: 'polar_rejected' }
        : { status: 'uncertain', code: 'polar_unavailable' };
    }
  }
}
