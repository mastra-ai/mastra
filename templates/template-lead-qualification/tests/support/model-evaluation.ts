import { createHash } from 'node:crypto';
import {
  qualificationConfig,
  qualificationConfigSchema,
  snapshotConfiguration,
} from '../../src/mastra/config/qualification';
import { normalizedEventSchema } from '../../src/mastra/contracts';
import type { ModelProfiles } from '../../src/mastra/model-evaluation-data';
import { OpenAIEvidenceProvider } from '../../src/mastra/providers/evidence';
import type { EvidenceProvider, ResearchContext } from '../../src/mastra/providers/evidence';
import type { Telemetry } from '../../src/mastra/telemetry';
import { harness } from './application';

export const modelEvaluationConfig = qualificationConfigSchema.parse({
  ...qualificationConfig,
  research: {
    ...qualificationConfig.research,
    maxRetries: 0,
    targeted: {
      ...qualificationConfig.research.targeted,
      order: ['businessModel', 'employeeCount', 'headquartersCountry', 'buyingIntent'],
    },
  },
});
export interface ModelCollectionHooks {
  admitted(runId: string): Promise<void>;
  stage<T>(stage: 'extract' | 'verify', context: ResearchContext, work: () => Promise<T>): Promise<T>;
  measurement: Telemetry['research'];
}
/** Only literal source material reaches the provider; labels and interpretation flags are not accepted here. */
export async function modelEvaluationHarness(dataset: ModelProfiles, hooks: ModelCollectionHooks) {
  const profiles = new Map<string, ModelProfiles['cases'][number]>();
  const model = new OpenAIEvidenceProvider();
  const evidence: EvidenceProvider = {
    id: 'openai-web',
    async search(_branch, context) {
      const profile = profiles.get(context.runId)!;
      return {
        sourceUrls: [],
        evidence: profile.materials.map(material => ({
          ...material,
          kind: 'website' as const,
          providerId: 'openai-web',
          retrieval: 'api' as const,
          retrievedAt: dataset.assessmentTime,
          digest: createHash('sha256').update(material.excerpt).digest('hex'),
        })),
      };
    },
    extract: (branch, material, context) =>
      hooks.stage('extract', context, () => model.extract(branch, material, context)),
    verify: (branch, candidates, material, context) =>
      hooks.stage('verify', context, () => model.verify(branch, candidates, material, context)),
  };
  const app = await harness({ qualification: modelEvaluationConfig, evidence: [evidence] });
  const measure = app.store.qualifications.measurement;
  app.store.qualifications.measurement = async data => {
    await hooks.measurement(data);
    await measure?.(data);
  };
  async function assess(profile: ModelProfiles['cases'][number]) {
    const event = normalizedEventSchema.parse({
      version: 1,
      type: 'lead.received',
      sourceId: 'local-inbound',
      eventId: profile.id,
      receivedAt: dataset.assessmentTime,
      lead: profile.lead,
      destination: { providerId: 'local', reference: profile.lead.reference },
    });
    const run = await app.store.accept(
      event,
      1000,
      snapshotConfiguration(modelEvaluationConfig, dataset.assessmentTime),
    );
    profiles.set(run.runId, profile);
    await hooks.admitted(run.runId);
    const assessment = (await app.qualification.qualify(run.runId, event))!;
    return { runId: run.runId, assessment, budget: (await app.store.qualifications.get(run.runId))!.budget };
  }
  return { ...app, assess };
}
