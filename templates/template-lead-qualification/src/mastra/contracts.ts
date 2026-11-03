import { isIP } from 'node:net';
import { domainToASCII } from 'node:url';
import { z } from 'zod';

const reference = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:@-]*$/);
const timestamp = z.iso.datetime({ offset: true });

export const domainSchema = z
  .string()
  .trim()
  .max(253)
  .regex(/^[\p{L}\p{N}\p{M}.-]+$/u, 'Use a hostname without URL syntax')
  .transform(value => domainToASCII(value.toLowerCase().replace(/\.$/, '')))
  .refine(
    value =>
      value.length <= 253 &&
      !isIP(value) &&
      /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{0,58}[a-z0-9])$/.test(value) &&
      !/(^|\.)(localhost|local|internal|test|invalid)$/.test(value),
    'Use a public DNS hostname without a URL, port, or path',
  );

export const emailSchema = z
  .string()
  .trim()
  .max(254)
  .transform(value => {
    const separator = value.lastIndexOf('@');
    return { local: separator < 0 ? '' : value.slice(0, separator), domain: value.slice(separator + 1) };
  })
  .pipe(
    z.strictObject({
      local: z
        .string()
        .min(1)
        .max(64)
        .regex(/^(?!\.)(?!.*\.\.)[A-Za-z0-9_'+.-]*[A-Za-z0-9_+-]$/, 'Use a valid email local part'),
      domain: domainSchema,
    }),
  )
  .transform(({ local, domain }) => `${local}@${domain}`)
  .pipe(z.string().max(254));

export const leadSchema = z
  .strictObject({
    reference,
    domain: domainSchema.optional(),
    email: emailSchema.optional(),
    crm: z.strictObject({ providerId: reference, recordId: reference }).optional(),
    declaredCompanyName: z.string().trim().min(1).max(200).optional(),
    inquiry: z
      .strictObject({
        type: z.enum(['demo_request', 'sales_contact_request', 'purchase_inquiry']),
        occurredAt: timestamp,
        text: z.string().trim().min(1).max(2000),
      })
      .optional(),
  })
  .refine(value => Boolean(value.domain || value.email || value.crm), 'Provide a domain, email, or CRM reference')
  .refine(
    value => !value.domain || !value.email || value.domain === value.email.split('@')[1],
    'Domain and email domain must agree',
  );

export const leadEventSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('lead.received'),
  eventId: reference,
  occurredAt: timestamp.optional(),
  lead: leadSchema,
  destinationReference: reference.optional(),
  supersedesAssessmentId: z.uuid().optional(),
});

export const normalizedEventSchema = z
  .strictObject({
    version: z.literal(1),
    type: z.literal('lead.received'),
    eventId: reference,
    sourceId: reference,
    receivedAt: timestamp,
    occurredAt: timestamp.optional(),
    lead: leadSchema,
    destination: z.strictObject({ providerId: reference, reference }),
    supersedesAssessmentId: z.uuid().optional(),
  })
  .refine(
    value =>
      (!value.occurredAt || Date.parse(value.occurredAt) <= Date.parse(value.receivedAt)) &&
      (!value.lead.inquiry || Date.parse(value.lead.inquiry.occurredAt) <= Date.parse(value.receivedAt)),
    'Occurrence time cannot follow receipt time',
  );

export const runReferenceSchema = z.strictObject({ runId: z.uuid() });
export const intakeResultSchema = z.strictObject({ runId: z.uuid(), status: z.literal('intake_received') });
export type LeadEvent = z.infer<typeof leadEventSchema>;
export type NormalizedEvent = z.infer<typeof normalizedEventSchema>;
