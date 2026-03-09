// @ts-nocheck
import { PgVector } from '@mastra/stores/pg';

const pgVector = new PgVector({
  connectionString: process.env.POSTGRES_CONNECTION_STRING!
});

const another = new PgVector({
  connectionString: connectionStr
});

// Should NOT transform - already object
const correct = new PgVector({ connectionString: 'test' });
