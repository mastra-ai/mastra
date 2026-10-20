import { z } from 'zod';
import { approvedUrl } from './research/page-retrieval';
import { leadSchema } from './contracts';
import { businessModelLabelSchema, outcomes, researchTargetSchema } from './config/qualification';
import { employeeIntervalSchema, factSchema, identitySchema, signalSchema } from './research/contracts';

const id = z.string().regex(/^[a-zA-Z0-9._-]{1,100}$/);
const unique = <T>(values: T[]) => new Set(values).size === values.length;
const passage = z.strictObject({ materialId: id, quote: z.string().min(1).max(2000) });
const material = z.strictObject({
  id: id.refine(value => value !== 'submitted-inquiry'),
  source: z.url().refine(value => new URL(value).protocol === 'https:'),
  title: z.string().min(1).max(200),
  publishedAt: z.iso.datetime({ offset: true }).nullable(),
  excerpt: z.string().min(1).max(24000),
});
export const modelProfilesSchema = z
  .strictObject({
    version: z.literal(1),
    kind: z.literal('model_passages'),
    assessmentTime: z.iso.datetime({ offset: true }),
    cases: z.array(z.strictObject({ id, lead: leadSchema, materials: z.array(material).max(2) })).length(24),
  })
  .refine(
    value =>
      unique(value.cases.map(item => item.id)) &&
      value.cases.every(item => unique(item.materials.map(source => source.id))),
    'Case and material IDs must be unique',
  )
  .refine(
    value =>
      value.cases.filter(item => item.lead.domain).length === 20 &&
      value.cases.every(item =>
        item.lead.domain
          ? Boolean(item.lead.inquiry) && item.materials.length > 0
          : !item.lead.inquiry && item.materials.length === 0,
      ),
    'Use20 domain/inquiry cases and4 identity-only cases',
  );
export type ModelProfiles = z.infer<typeof modelProfilesSchema>;
const nonaccepted = z.strictObject({
  match: z.literal('nonaccepted'),
  allowedDispositions: z.tuple([z.literal('missing'), z.literal('unsupported')]),
  value: z.null(),
  rationale: z.string().trim().min(1).max(1000),
  evidenceBasis: z.array(passage).min(1).max(4),
});
const attributeLabel = (value: z.ZodType<z.infer<typeof factSchema>['value']>) =>
  z.union([
    z
      .strictObject({
        match: z.literal('exact'),
        disposition: factSchema.shape.disposition,
        value,
        support: z.array(passage).max(4),
      })
      .refine(
        label =>
          label.disposition === 'accepted' ? label.value !== null && label.support.length > 0 : label.value === null,
        'Accepted labels need values/support; nonaccepted exact labels are null',
      )
      .refine(
        label => label.disposition !== 'conflicting' || label.support.length >= 2,
        'Conflicts require multiple supporting passages',
      ),
    nonaccepted,
  ]);
const coverage = [
  'qualified',
  'nurture',
  'hard_exclusion',
  'missing',
  'irrelevant',
  'conflict',
  'boundary',
  'business_inference',
  'email_identity',
  'crm_identity',
  'observed_range',
] as const;
export const modelLabelsSchema = z
  .strictObject({
    version: z.literal(2),
    kind: z.literal('model_passages'),
    datasetId: id,
    profilesDigest: z.string().regex(/^[a-f0-9]{64}$/),
    provenance: z.string().min(1).max(2000),
    policyVersion: z.string().min(1).max(100),
    cases: z
      .array(
        z.strictObject({
          id,
          population: z.enum(['domain', 'email', 'crm']),
          coverage: z.array(z.enum(coverage)).min(1).max(4),
          identity: z
            .strictObject({ status: identitySchema.shape.status, domain: identitySchema.shape.domain })
            .refine(value => value.status !== 'resolved' || value.domain !== null),
          attributes: z.strictObject({
            businessModel: attributeLabel(businessModelLabelSchema.nullable()),
            employeeCount: attributeLabel(employeeIntervalSchema.nullable()),
            headquartersCountry: attributeLabel(
              z
                .string()
                .regex(/^[A-Z]{2}$/)
                .nullable(),
            ),
            buyingIntent: attributeLabel(z.array(signalSchema).nullable()),
          }),
          classification: z.enum(outcomes),
          score: z.number().int().min(0).max(100),
          disqualifiers: z.array(z.enum(['businessModel', 'employeeCount', 'headquartersCountry'])).max(3),
        }),
      )
      .length(24),
  })
  .refine(value => unique(value.cases.map(item => item.id)), 'Case IDs must be unique')
  .refine(
    value => coverage.every(category => value.cases.some(item => item.coverage.includes(category))),
    'Required coverage categories must be present',
  );
export type ModelLabels = z.infer<typeof modelLabelsSchema>;
export type ModelAttributeLabel =
  ModelLabels['cases'][number]['attributes'][keyof ModelLabels['cases'][number]['attributes']];
export function modelAttributeMatches(label: ModelAttributeLabel, fact: { disposition: string; value: unknown }) {
  return label.match === 'nonaccepted'
    ? fact.value === null && label.allowedDispositions.some(value => value === fact.disposition)
    : label.disposition === fact.disposition && JSON.stringify(label.value) === JSON.stringify(fact.value);
}
/** Validate source attribution before presenting any dataset for approval; never render expectations. */
export const modelDatasetSchema = z
  .strictObject({ profiles: modelProfilesSchema, labels: modelLabelsSchema })
  .superRefine(({ profiles, labels }, context) => {
    const fail = (message: string) => context.addIssue({ code: 'custom', message });
    if (profiles.cases.some(item => !labels.cases.some(label => label.id === item.id))) {
      fail('model_dataset_case_set_mismatch');
      return;
    }
    for (const profile of profiles.cases) {
      if (profile.lead.inquiry && Date.parse(profile.lead.inquiry.occurredAt) > Date.parse(profiles.assessmentTime))
        fail('model_dataset_future_inquiry');
      for (const material of profile.materials) {
        if (material.publishedAt && Date.parse(material.publishedAt) > Date.parse(profiles.assessmentTime))
          fail('model_dataset_future_material');
        try {
          approvedUrl(material.source, [profile.lead.domain!]);
        } catch {
          fail('model_dataset_unapproved_source');
        }
      }
    }
    for (const label of labels.cases) {
      const profile = profiles.cases.find(item => item.id === label.id)!;
      if (
        label.population !== (profile.lead.domain ? 'domain' : profile.lead.email ? 'email' : 'crm') ||
        label.identity.domain !== (profile.lead.domain ?? null)
      )
        fail('model_dataset_identity_population_mismatch');
      const sources = new Map(profile.materials.map(source => [source.id, source.excerpt]));
      if (profile.lead.inquiry) sources.set('submitted-inquiry', profile.lead.inquiry.text);
      for (const attribute of researchTargetSchema.options) {
        const expected = label.attributes[attribute];
        for (const support of expected.match === 'exact' ? expected.support : expected.evidenceBasis)
          if (!sources.get(support.materialId)?.includes(support.quote)) fail('model_dataset_support_not_literal');
      }
    }
  });
export function validateModelDataset(profiles: ModelProfiles, labels: ModelLabels) {
  modelDatasetSchema.parse({ profiles, labels });
}
