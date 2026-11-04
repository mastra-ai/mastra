import { isAbsolute } from 'node:path';
import { z } from 'zod';
import { openDatabase } from './database.ts';
import { writeTransaction } from './transaction.ts';
import { scopedRunId, dispositionSchema } from '../contracts/review.ts';
import { mappingSchema } from '../contracts/mapping.ts';
import { hash } from '../contracts/primitives.ts';
import { canonicalJson } from '../intake/source.ts';
import type { InputSourceSnapshot } from '../intake/source.ts';
import { sourceBytes } from './completion.ts';

const checkpointSchema = z
  .object({
    runId: scopedRunId,
    sourcePath: z.string().max(2000).refine(isAbsolute).optional(),
    sourceId: z.string().min(1),
    sourceSha256: hash,
    originalName: z.string().min(1),
    mapping: mappingSchema.optional(),
    mappingAnswers: z.record(z.string(), z.string()).default({}),
    consent: z.array(z.string()).default([]),
    reviewRevision: z.int().nonnegative().optional(),
    reviewDigest: hash.optional(),
    reviewIssue: z
      .string()
      .regex(/^[A-Z][A-Z0-9_]{0,79}$/)
      .optional(),
    dispositions: z.array(dispositionSchema).default([]),
  })
  .strict();
export type RespondCheckpoint = z.infer<typeof checkpointSchema>;
export async function openRespondStore(url: string) {
  const client = await openDatabase(url);
  return {
    read: async (runId: string) => {
      const r = await client.execute({
        sql: 'SELECT checkpoint_json,source_bytes FROM vrq_respond WHERE run_id = ?',
        args: [runId],
      });
      if (!r.rows[0]) return undefined;
      const checkpoint = checkpointSchema.parse(JSON.parse(String(r.rows[0].checkpoint_json))),
        bytes = sourceBytes(r.rows[0].source_bytes);
      const source: InputSourceSnapshot = {
        sourceId: checkpoint.sourceId,
        originalName: checkpoint.originalName,
        sha256: checkpoint.sourceSha256,
        sizeBytes: bytes.length,
        bytes,
      };
      return { checkpoint, source };
    },
    initialize: async (runId: string, source: InputSourceSnapshot, sourcePath?: string) => {
      const checkpoint = checkpointSchema.parse({
        runId,
        sourcePath,
        sourceId: source.sourceId,
        sourceSha256: source.sha256,
        originalName: source.originalName,
      });
      await client.execute({
        sql: 'INSERT INTO vrq_respond (run_id,checkpoint_json,source_bytes) VALUES (?,?,?)',
        args: [runId, canonicalJson(checkpoint), source.bytes],
      });
      return checkpoint;
    },
    save: async (checkpoint: RespondCheckpoint) =>
      writeTransaction(client, async tx => {
        await tx.execute({
          sql: 'UPDATE vrq_respond SET checkpoint_json = ? WHERE run_id = ?',
          args: [canonicalJson(checkpointSchema.parse(checkpoint)), checkpoint.runId],
        });
      }),
    close: () => client.close(),
  };
}
