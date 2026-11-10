import { databaseUrl, openDatabase } from './database.ts';
import { defaultLimits, limitsSchema } from '../contracts/limits.ts';
import type { InputLimits } from '../contracts/limits.ts';
import type { QuestionnaireInput } from '../contracts/questionnaire.ts';
import type { ConfirmedInputMapping } from '../contracts/mapping.ts';
import type { InputSourceSnapshot } from '../intake/source.ts';
import type { EvidenceSnapshotRecord, EligibleSource } from '../evidence/snapshot.ts';
import { persistIntake, readIntake } from './intake.ts';
import { persistEvidence, readEvidence } from './evidence.ts';

export async function openIntakeStore(url = databaseUrl, configuredLimits: InputLimits = defaultLimits) {
  const limits = limitsSchema.parse(configuredLimits);
  const client = await openDatabase(url);
  return {
    persistIntake: (
      runId: string,
      input: QuestionnaireInput,
      mapping: ConfirmedInputMapping,
      source: InputSourceSnapshot,
    ) => persistIntake(client, limits, runId, input, mapping, source),
    persistEvidence: (record: EvidenceSnapshotRecord, sources: EligibleSource[]) =>
      persistEvidence(client, limits, record, sources),
    readIntake: (runId: string) => readIntake(client, runId),
    readEvidence: (runId: string) => readEvidence(client, runId),
    close: () => client.close(),
  };
}
