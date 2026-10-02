import { defineConfig, devices } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const port = Number(process.env.DEMO_E2E_PORT ?? '4300');
const database = join(tmpdir(), `northstar-demo-e2e-${process.pid}.db`);
const localPort = Number(process.env.DEMO_LOCAL_E2E_PORT ?? port + 1);
const localDatabase = join(tmpdir(), `northstar-local-e2e-${process.pid}.db`);
export default defineConfig({
  testDir: './test/e2e',
  timeout: 30_000,
  use: { baseURL: `http://127.0.0.1:${port}`, ...devices['Desktop Chrome'] },
  webServer: [
    {
      command: `APP_MODE=staging DATABASE_URL=file:${database}.backend DEMO_PORT=${port} DEMO_DATABASE_URL=file:${database} INTERCOM_APP_ID=app_e2e INTERCOM_MESSENGER_JWT_SECRET=widget-e2e-secret npm run e2e:serve`,
      url: `http://127.0.0.1:${port}`,
      reuseExistingServer: false,
    },
    {
      command: `APP_MODE=local LOCAL_DEMO_DATABASE_URL=file:${localDatabase}.backend LOCAL_DEMO_CLIENT_DATABASE_URL=file:${localDatabase} DEMO_PORT=${localPort} LOCAL_DEMO_BACKEND_URL=http://127.0.0.1:1 npm run e2e:serve`,
      url: `http://127.0.0.1:${localPort}`,
      reuseExistingServer: false,
    },
  ],
});
