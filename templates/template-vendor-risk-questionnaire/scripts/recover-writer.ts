import { parseArgs } from 'node:util';
import { databaseUrl } from '../src/mastra/persistence/database.ts';
import { recoverWriterLease } from '../src/mastra/persistence/ownership.ts';
import { z } from 'zod';

const { values } = parseArgs({ options: { token: { type: 'string' } } });
try {
  recoverWriterLease(databaseUrl, z.uuid().parse(values.token));
  console.log(JSON.stringify({ state: 'writer-recovered' }));
} catch {
  console.error(JSON.stringify({ code: 'WRITER_RECOVERY_REFUSED' }));
  process.exitCode = 1;
}
