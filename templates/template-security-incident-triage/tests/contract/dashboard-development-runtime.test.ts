import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

describe('dashboard development runtime', () => {
  it('renders the unauthenticated dashboard with the loader used by npm run dev', async () => {
    const program = `
      const { Hono } = await import("hono");
      const { requestContextMiddleware } = await import("./src/http-context.ts");
      const { registerDashboardRoutes } = await import("./src/app/dashboard/routes.tsx");

      const app = new Hono();
      app.use("*", requestContextMiddleware(() => "runtime-contract"));
      registerDashboardRoutes(app, {
        store: {
          execute: async () => ({ rows: [] }),
          transaction: async () => { throw new Error("not used"); },
          close: () => undefined,
        },
        logger: { write: () => undefined },
        config: {
          enabled: false,
          dashboardOrigin: "http://localhost:3000",
          sessionMaxAgeSeconds: 28_800,
          sseMaxConnections: 4,
          trustedProxy: false,
        },
        approvalConfig: {
          mode: "local",
          localApprovalsEnabled: false,
          actionTimeoutMs: 1_000,
          rateLimit: 1,
        },
        sessionClient: null,
        reconcileApprovalRun: async () => "completed",
      });

      const response = await app.request("http://localhost:3000/dashboard");
      const body = await response.text();
      if (response.status !== 200 || !body.includes("Sign in to access")) {
        throw new Error(
          "Dashboard did not render: " + response.status + " " + body,
        );
      }
    `;

    const result = await execFileAsync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', program], {
      cwd: process.cwd(),
    });

    expect(result.stderr).toBe('');
  });
});
