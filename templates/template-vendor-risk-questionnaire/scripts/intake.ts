import { parseArgs } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { defaultLimits } from '../src/mastra/contracts/limits.ts';
import { mappingSchema } from '../src/mastra/contracts/mapping.ts';
import { readSource, readJson, diagnostic } from '../src/mastra/intake/source.ts';
import { IntakeCoordinator } from '../src/mastra/intake/adapters.ts';
import { buildEvidenceSnapshot, loadManifest } from '../src/mastra/evidence/snapshot.ts';
import { openIntakeStore } from '../src/mastra/persistence/store.ts';
import { runtimeRoot } from '../src/mastra/persistence/database.ts';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: Object.fromEntries(
    [
      'source',
      'source-id',
      'mapping',
      'run-id',
      'questionnaire-id',
      'organization-id',
      'title',
      'manifest',
      'root',
      'product',
      'environment',
      'domains',
      'query',
    ].map(k => [k, { type: 'string' as const }]),
  ),
});
const required = (key: string) => z.string().min(1).parse(values[key]);
const context = { limits: defaultLimits, signal: AbortSignal.timeout(defaultLimits.timeoutMs) };
const runId = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,100}$/)
  .parse(values['run-id'] ?? randomUUID());
try {
  if (positionals[0] === 'inspect') {
    const source = await readSource(required('source'), values['source-id'] ?? 'questionnaire-source', defaultLimits);
    const inspection = await new IntakeCoordinator().inspect(source, context);
    if (inspection.mappingCandidates.length === 1) {
      await mkdir(resolve(runtimeRoot, 'mappings'), { recursive: true });
      await writeFile(
        resolve(runtimeRoot, 'mappings', `${source.sha256}.json`),
        JSON.stringify(inspection.mappingCandidates[0], null, 2) + '\n',
        { flag: 'wx' },
      ).catch((e: NodeJS.ErrnoException) => {
        if (e.code !== 'EEXIST') throw e;
      });
    }
    console.log(JSON.stringify(inspection, null, 2));
    if (inspection.status === 'rejected') process.exitCode = 1;
  } else if (positionals[0] === 'import') {
    const source = await readSource(required('source'), values['source-id'] ?? 'questionnaire-source', defaultLimits);
    const mapping = mappingSchema.parse(await readJson(required('mapping'), 'confirmed-mapping'));
    const imported = await new IntakeCoordinator().import(
      source,
      mapping,
      {
        questionnaireId: required('questionnaire-id'),
        organizationId: required('organization-id'),
        title: required('title'),
      },
      context,
    );
    const store = await openIntakeStore();
    try {
      const result = await store.persistIntake(runId, imported.input, imported.mapping, source);
      console.log(
        JSON.stringify(
          {
            ...result,
            status: 'received',
            questions: imported.input.questions.length,
            coverage: imported.normalization.coverage,
          },
          null,
          2,
        ),
      );
    } finally {
      store.close();
    }
  } else if (positionals[0] === 'evidence') {
    const snapshot = await buildEvidenceSnapshot({
      runId,
      manifest: await loadManifest(required('manifest')),
      root: required('root'),
      runtimeRoot,
      scope: {
        organizationId: required('organization-id'),
        product: required('product'),
        environment: required('environment'),
        domains: required('domains').split(','),
      },
      context,
    });
    const store = await openIntakeStore();
    try {
      await store.persistEvidence(snapshot.record, snapshot.sources);
      console.log(
        JSON.stringify(
          {
            runId,
            digest: snapshot.record.digest,
            eligibleDocuments: snapshot.record.documents.length,
            denied: snapshot.record.denied,
            hits: values.query ? await snapshot.search(values.query) : [],
          },
          null,
          2,
        ),
      );
    } finally {
      store.close();
    }
  } else {
    throw new Error('Use inspect, import or evidence. See README for arguments.');
  }
} catch (error) {
  console.error(JSON.stringify(diagnostic(error, values['source-id'] ?? 'operator-input')));
  process.exitCode = 1;
}
