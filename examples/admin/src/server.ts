/**
 * MastraAdmin Development Server
 *
 * This server runs the full admin API with dev authentication.
 * No Supabase required - uses a mock auth provider for development.
 *
 * Run with: pnpm dev:server
 * Then start the UI: pnpm dev:ui
 * Or run both: pnpm dev:full
 */

import 'dotenv/config';

import { MastraAdmin, type AdminAuthProvider } from '@mastra/admin';
import { PostgresAdminStorage } from '@mastra/admin-pg';
import { AdminServer } from '@mastra/admin-server';
import { LocalProjectSource } from '@mastra/source-local';
import { LocalProcessRunner } from '@mastra/runner-local';
import { LocalEdgeRouter } from '@mastra/router-local';
import { LocalFileStorage } from '@mastra/observability-file-local';
import { resolve } from 'path';

// Configuration
const PORT = parseInt(process.env['PORT'] ?? '3001', 10);
const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_USER_EMAIL = 'demo@example.com';
const DEMO_USER_NAME = 'Demo User';
const DEV_TOKEN = 'dev-token';

/**
 * Development Auth Provider
 *
 * Accepts any token and returns the demo user.
 * For production, use Supabase or another auth provider.
 */
class DevAuthProvider implements AdminAuthProvider {
  async validateToken(token: string): Promise<{ userId: string } | null> {
    // Accept any token in dev mode
    if (token === DEV_TOKEN || token.startsWith('dev-') || token) {
      return {
        userId: DEMO_USER_ID,
      };
    }
    return null;
  }

  async getUser(userId: string): Promise<{ id: string; email?: string; name?: string } | null> {
    if (userId === DEMO_USER_ID) {
      return {
        id: DEMO_USER_ID,
        email: DEMO_USER_EMAIL,
        name: DEMO_USER_NAME,
      };
    }
    return null;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('MastraAdmin Development Server');
  console.log('='.repeat(60));
  console.log();

  // Initialize storage
  console.log('[1] Initializing PostgreSQL storage...');
  const storage = new PostgresAdminStorage({
    connectionString: process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5433/mastra_admin',
    schemaName: 'mastra_admin',
  });

  // Initialize project source
  console.log('[2] Initializing local project source...');
  const projectsDir = process.env['PROJECTS_DIR'] ?? resolve(process.cwd(), '../');
  const source = new LocalProjectSource({
    basePaths: [projectsDir],
    watchChanges: false,
    maxDepth: 3,
  });

  // Initialize runner
  console.log('[3] Initializing local process runner...');
  const runner = new LocalProcessRunner({
    portRange: { start: 4111, end: 4200 },
    maxConcurrentBuilds: 3,
    defaultBuildTimeoutMs: 600000,
    logRetentionLines: 10000,
    buildDir: resolve(process.cwd(), '.mastra/builds'),
  });

  // Initialize router with reverse-proxy strategy and custom domain
  // This allows accessing deployments via http://{subdomain}.mastra.local:3100/
  // Note: Requires sudo to modify /etc/hosts, or manually add entries
  console.log('[4] Initializing local edge router...');
  const router = new LocalEdgeRouter({
    strategy: 'reverse-proxy',
    baseDomain: 'mastra.local',
    proxyPort: 3100,
    portRange: { start: 4100, end: 4199 }, // Backend ports (hidden from user)
    enableHostsFile: true, // Auto-manage /etc/hosts entries (requires sudo)
    logRoutes: true,
  });

  // Initialize file storage
  console.log('[5] Initializing local file storage...');
  const fileStorage = new LocalFileStorage({
    baseDir: resolve(process.cwd(), '.mastra/observability'),
    atomicWrites: true,
  });

  // Initialize dev auth provider
  console.log('[6] Initializing dev auth provider...');
  const auth = new DevAuthProvider();

  // Create MastraAdmin
  console.log('[7] Creating MastraAdmin instance...');
  const admin = new MastraAdmin({
    licenseKey: 'dev',
    storage,
    source,
    runner,
    router,
    observability: {
      fileStorage,
    },
    auth,
  });

  await admin.init();
  console.log('    MastraAdmin initialized');
  console.log('    License:', admin.getLicenseInfo().tier);

  // Start the reverse proxy
  console.log('    Starting reverse proxy...');
  await router.startProxy();
  console.log('    Reverse proxy started on port 3100');

  // Recover any queued builds from the database
  console.log('    Recovering queued builds...');
  const queuedBuilds = await storage.listQueuedBuilds();
  const orchestrator = admin.getOrchestrator();
  for (const build of queuedBuilds) {
    await orchestrator.queueBuild(build.id);
    console.log(`    Requeued build ${build.id}`);
  }
  console.log(`    Recovered ${queuedBuilds.length} build(s)`);
  console.log();

  // Ensure demo user exists
  console.log('[8] Ensuring demo user exists...');
  let demoUser = await admin.getUser(DEMO_USER_ID);
  if (!demoUser) {
    await storage.createUser({
      id: DEMO_USER_ID,
      email: DEMO_USER_EMAIL,
      name: DEMO_USER_NAME,
      avatarUrl: null,
    });
    demoUser = await admin.getUser(DEMO_USER_ID);
    console.log('    Created demo user:', demoUser?.email);
  } else {
    console.log('    Demo user exists:', demoUser.email);
  }
  console.log();

  // Create AdminServer
  console.log('[9] Starting AdminServer...');
  const server = new AdminServer({
    admin,
    port: PORT,
    cors: {
      origin: [
        'http://localhost:3001',
        'http://localhost:3002',
        'http://localhost:5173',
        'http://127.0.0.1:3002',
        'http://127.0.0.1:5173',
      ],
      credentials: true,
    },
  });

  await server.start();
  console.log();
  console.log('='.repeat(60));
  console.log('Server Ready!');
  console.log('='.repeat(60));
  console.log();
  console.log(`API URL:   http://localhost:${PORT}/api`);
  console.log(`Health:    http://localhost:${PORT}/api/health`);
  console.log(`Proxy:     http://{subdomain}.mastra.local:3100/`);
  console.log();
  console.log('Deployed Mastra instances are accessible via:');
  console.log('  http://{subdomain}.mastra.local:3100/');
  console.log();
  console.log('Note: /etc/hosts entries are auto-managed (requires sudo).');
  console.log('If not running as sudo, manually add: 127.0.0.1 {subdomain}.mastra.local');
  console.log();
  console.log('Dev Authentication:');
  console.log(`  User ID: ${DEMO_USER_ID}`);
  console.log(`  Email:   ${DEMO_USER_EMAIL}`);
  console.log(`  Token:   ${DEV_TOKEN} (or any token)`);
  console.log();
  console.log('To start the Admin UI:');
  console.log('  pnpm dev:ui');
  console.log();
  console.log('Or run everything together:');
  console.log('  pnpm dev:full');
  console.log();
  console.log('Press Ctrl+C to stop.');
  console.log();

  // Handle shutdown
  const shutdown = async () => {
    console.log('\nShutting down...');
    await router.stopProxy();
    await server.stop();
    await admin.shutdown();
    console.log('Done.');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Keep running
  await new Promise(() => {});
}

main().catch(error => {
  console.error('Server failed to start:', error);
  process.exit(1);
});
