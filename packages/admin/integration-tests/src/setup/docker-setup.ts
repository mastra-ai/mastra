import { execSync } from 'node:child_process';
import path from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dockerComposePath = path.resolve(__dirname, '../..');

export async function setup() {
  console.info('Starting Docker services...');

  try {
    // Start services
    execSync('docker compose up -d', {
      cwd: dockerComposePath,
      stdio: 'inherit',
    });

    // Wait for services to be healthy
    await waitForPostgres();
    await waitForClickHouse();

    console.info('All services are ready!');
  } catch (error) {
    console.error('Failed to start Docker services:', error);
    throw error;
  }
}

export async function teardown() {
  console.info('Stopping Docker services...');

  try {
    execSync('docker compose down --volumes', {
      cwd: dockerComposePath,
      stdio: 'inherit',
    });
  } catch (error) {
    console.error('Failed to stop Docker services:', error);
  }
}

async function waitForPostgres(maxRetries = 30): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      execSync('docker compose exec -T postgres pg_isready -U mastra -d mastra_admin_test', {
        cwd: dockerComposePath,
        stdio: 'pipe',
      });
      return;
    } catch {
      await setTimeout(1000);
    }
  }
  throw new Error('PostgreSQL did not become ready in time');
}

async function waitForClickHouse(maxRetries = 30): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      execSync('docker compose exec -T clickhouse clickhouse-client --query "SELECT 1"', {
        cwd: dockerComposePath,
        stdio: 'pipe',
      });
      return;
    } catch {
      await setTimeout(1000);
    }
  }
  throw new Error('ClickHouse did not become ready in time');
}
