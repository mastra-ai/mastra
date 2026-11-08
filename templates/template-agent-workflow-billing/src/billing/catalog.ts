import { z } from 'zod';
import { identifierSchema, positiveQuantitySchema } from './contracts.js';

export const catalogReferenceSchema = z.strictObject({ key: identifierSchema, version: identifierSchema });
export const allowanceSchema = z
  .strictObject({
    key: identifierSchema,
    version: identifierSchema,
    meter: identifierSchema,
    kind: z.enum(['order', 'subscription']),
    units: positiveQuantitySchema,
    expiry: z.discriminatedUnion('type', [
      z.strictObject({ type: z.literal('none') }),
      z.strictObject({ type: z.literal('duration'), milliseconds: positiveQuantitySchema }),
      z.strictObject({ type: z.literal('period') }),
    ]),
  })
  .refine(value => (value.kind === 'subscription') === (value.expiry.type === 'period'));
export const offerSchema = z
  .strictObject({
    key: identifierSchema,
    version: identifierSchema,
    allowances: z.array(catalogReferenceSchema).max(100).default([]),
    entitlements: z.array(identifierSchema).max(100).default([]),
    subscriptions: z.array(identifierSchema).max(100).default([]),
  })
  .transform(offer => ({
    ...offer,
    allowances: offer.allowances.sort((a, b) =>
      referenceKey(a) < referenceKey(b) ? -1 : referenceKey(a) > referenceKey(b) ? 1 : 0,
    ),
    entitlements: offer.entitlements.sort(),
    subscriptions: offer.subscriptions.sort(),
  }));
export const referenceKey = (value: { key: string; version: string }) => JSON.stringify([value.key, value.version]);
export const commercialCatalogSchema = z
  .strictObject({
    allowances: z.array(allowanceSchema).max(100).default([]),
    offers: z.array(offerSchema).max(100).default([]),
  })
  .superRefine((catalog, ctx) => {
    const unique = (keys: string[]) => new Set(keys).size === keys.length;
    for (const entries of [catalog.allowances, catalog.offers])
      if (!unique(entries.map(referenceKey))) ctx.addIssue({ code: 'custom', message: 'Duplicate catalog revision.' });
    const references = new Set(catalog.allowances.map(referenceKey));
    for (const offer of catalog.offers) {
      if (!unique(offer.allowances.map(referenceKey)) || !unique(offer.entitlements) || !unique(offer.subscriptions))
        ctx.addIssue({ code: 'custom', message: 'Duplicate offer term.' });
      if (offer.allowances.some(value => !references.has(referenceKey(value))))
        ctx.addIssue({ code: 'custom', message: 'Unknown allowance revision.' });
    }
  });
export type CommercialCatalog = z.infer<typeof commercialCatalogSchema>;

export function resolveAllowance<
  Catalog extends { readonly allowances: readonly { readonly key: string; readonly version: string }[] },
>(
  catalog: Catalog,
  reference: { readonly key: string; readonly version: string },
): Catalog['allowances'][number] | undefined {
  return catalog.allowances.find(value => referenceKey(value) === referenceKey(reference));
}
