import { createClient } from '@libsql/client';

const [dbPath, workerId, writeCountArg] = process.argv.slice(2);
const writeCount = Number(writeCountArg);
const client = createClient({ url: `file:${dbPath}`, timeout: 5000 });

async function executeWithRetry(statement) {
  let delay = 20;
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      return await client.execute(statement);
    } catch (error) {
      const isBusy = error?.code === 'SQLITE_BUSY' || error?.code === 'SQLITE_LOCKED';
      if (!isBusy || attempt === 10) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
}

try {
  const mode = await executeWithRetry('PRAGMA journal_mode=DELETE;');
  if (Object.values(mode.rows[0] ?? {})[0] !== 'delete') {
    throw new Error(`SQLite did not enter DELETE mode: ${JSON.stringify(mode.rows)}`);
  }

  for (let index = 0; index < writeCount; index++) {
    await executeWithRetry({
      sql: 'INSERT INTO stress_writes (id, worker_id, write_index) VALUES (?, ?, ?)',
      args: [`${workerId}-${index}`, workerId, index],
    });
  }
} finally {
  client.close();
}
