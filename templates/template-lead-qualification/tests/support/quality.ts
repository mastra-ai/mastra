import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { qualificationConfig, snapshotConfiguration } from '../../src/mastra/config/qualification';
import { normalizedEventSchema } from '../../src/mastra/contracts';
import { candidateSchema } from '../../src/mastra/research/contracts';
import type { Candidate } from '../../src/mastra/research/contracts';
import type { EvidenceProvider } from '../../src/mastra/providers/evidence';
import { harness } from './application';

export const profilesSchema = z.strictObject({
  version: z.literal(1),
  assessmentTime: z.iso.datetime({ offset: true }),
  cases: z.array(
    z.strictObject({
      id: z.string(),
      employees: z.object({ min: z.number(), max: z.number().nullable() }).nullable(),
      country: z.string().nullable(),
      business: z.string().nullable(),
      intent: z.boolean(),
      intentAt: z.string(),
      identity: z.enum(['domain', 'email', 'crm']),
      ambiguous: z.boolean(),
      conflict: z.boolean(),
      unsupported: z.boolean(),
      inferred: z.boolean(),
      intentUnknown: z.boolean(),
    }),
  ),
});
export type ExampleProfile = z.infer<typeof profilesSchema>['cases'][number];
export async function qualityFixtures() {
  const [profileText, labelText] = await Promise.all([
    readFile(new URL('../fixtures/qualification/profiles.v1.json', import.meta.url), 'utf8'),
    readFile(new URL('../fixtures/qualification/expected.v1.json', import.meta.url), 'utf8'),
  ]);
  return { profiles: profilesSchema.parse(JSON.parse(profileText)), labelText };
}
function profileProvider(profiles: Map<string, ExampleProfile>): EvidenceProvider {
  const excerpt = (profile: ExampleProfile) =>
    [
      `Business model: ${profile.business ?? 'not established'}.`,
      `Employees: ${JSON.stringify(profile.employees)}.`,
      profile.conflict ? 'Conflicting employee report: 400.' : '',
      `Headquarters country: ${profile.country ?? 'not established'}.`,
      profile.intent ? `Inbound demo request received ${profile.intentAt}.` : 'No buying inquiry observed.',
    ].join(' ');
  return {
    id: 'openai-web',
    async search(_branch, context) {
      const reservation = await context.store.reserve(context.runId, 'search', 128);
      await context.store.settle(reservation, { outputTokens: 1 });
      const text = excerpt(profiles.get(context.runId)!);
      return {
        sourceUrls: [],
        evidence: [
          {
            id: 'profile-source',
            kind: 'website',
            source: `https://${context.domain}/about`,
            title: 'Synthetic company profile',
            retrievedAt: context.snapshot.assessmentTime,
            publishedAt: null,
            excerpt: text,
            digest: createHash('sha256').update(text).digest('hex'),
            providerId: 'openai-web',
            retrieval: 'api',
          },
        ],
      };
    },
    async extract(branch, material, context) {
      const profile = profiles.get(context.runId)!;
      const source = material[0]!;
      const candidates: Candidate[] = [];
      const add = (
        attribute: Candidate['attribute'],
        value: unknown,
        quote: string,
        inference?: Candidate['inference'],
      ) =>
        candidates.push(
          candidateSchema.parse({
            id: attribute + candidates.length,
            attribute,
            value,
            quote,
            evidenceId: source.id,
            asOf: null,
            ...(inference ? { inference } : {}),
          }),
        );
      if (branch === 'firmographics') {
        if (profile.business) add('businessModel', profile.business, `Business model: ${profile.business}.`);
        if (profile.employees)
          add(
            'employeeCount',
            profile.employees,
            `Employees: ${JSON.stringify(profile.employees)}.`,
            profile.inferred
              ? {
                  rationale:
                    'A finite working estimate based on the stated workforce cue; upper bound is an uncertain assumption, not an observed ceiling.',
                  additionalPassages: [],
                }
              : undefined,
          );
        if (profile.conflict) add('employeeCount', { min: 400, max: 400 }, 'Conflicting employee report: 400.');
        if (profile.country) add('headquartersCountry', profile.country, `Headquarters country: ${profile.country}.`);
      } else if (profile.intent && !profile.intentUnknown)
        add(
          'buyingIntent',
          { type: 'demo_request', occurredAt: profile.intentAt },
          `Inbound demo request received ${profile.intentAt}.`,
        );
      return {
        identityAmbiguous: profile.ambiguous,
        candidates,
        intentCoverageComplete: !profile.intentUnknown,
      };
    },
    async verify(_branch, candidates, _material, context) {
      const profile = profiles.get(context.runId)!;
      return {
        supportedCandidateIds: candidates
          .filter(candidate => !(profile.unsupported && candidate.attribute === 'employeeCount'))
          .map(candidate => candidate.id),
        intentCoverageComplete: !profile.intentUnknown,
      };
    },
  };
}
export async function qualityHarness() {
  const profiles = new Map<string, ExampleProfile>();
  const config = {
    ...qualificationConfig,
    research: {
      ...qualificationConfig.research,
      targeted: {
        ...qualificationConfig.research.targeted,
        order: ['businessModel', 'employeeCount', 'headquartersCountry', 'buyingIntent'] as const,
      },
    },
  };
  const evidenceProvider = profileProvider(profiles);
  const app = await harness({
    qualification: {
      ...config,
      research: {
        ...config.research,
        targeted: { ...config.research.targeted, order: [...config.research.targeted.order] },
      },
    },
    evidence: [evidenceProvider],
  });
  async function assess(
    profile: ExampleProfile,
    assessmentTime = '2026-10-19T12:00:00Z',
    reference = profile.id,
    supersedesAssessmentId?: string,
  ) {
    const lead =
      profile.identity === 'domain'
        ? { domain: 'example.com' }
        : profile.identity === 'email'
          ? { email: 'candidate@example.com' }
          : { crm: { providerId: 'example-crm', recordId: 'example-record' } };
    const event = normalizedEventSchema.parse({
      version: 1,
      type: 'lead.received',
      sourceId: 'local-inbound',
      eventId: profile.id,
      receivedAt: assessmentTime,
      lead: { reference, ...lead },
      destination: { providerId: 'local', reference },
      supersedesAssessmentId,
    });
    const run = await app.store.accept(
      event,
      1000,
      snapshotConfiguration(
        {
          ...config,
          research: {
            ...config.research,
            targeted: { ...config.research.targeted, order: [...config.research.targeted.order] },
          },
        },
        assessmentTime,
      ),
    );
    profiles.set(run.runId, profile);
    const assessment = (await app.qualification.qualify(run.runId, event))!;
    return { run, assessment, event };
  }
  return { ...app, assess, profiles, evidenceProvider };
}
