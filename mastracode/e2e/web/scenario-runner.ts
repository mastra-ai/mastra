import { startAgentControllerServer } from './agent-controller-server';
import type { ScenarioServerOptions } from './agent-controller-server';
import { startAimock } from './aimock';
import { createDriver } from './driver';
import type { ScenarioDriver } from './driver';

/**
 * Scenario harness — mirrors how MastraCode's TUI scenarios run: start AIMock
 * with a fixture, stand up the real backend pointed at it, drive the real SDK,
 * then assert. Returns the driver + the AIMock request log for `verifyAimock`.
 */

export interface ScenarioContext {
  driver: ScenarioDriver;
  /** AIMock request log (OpenAI-shaped), for asserting what reached the model. */
  aimockRequests: () => unknown[];
  /** Raw fetch into the controller server (for endpoints the driver doesn't wrap). */
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  /** Base URL for the controller server (e.g. `http://scenario.local`). */
  baseUrl: string;
  /** The workspace root dir, when the scenario requested `server.workspace`. */
  workspaceRoot?: string;
}

export interface WebScenario {
  name: string;
  description: string;
  aimockFixture: string;
  resourceId?: string;
  /** Server options: attach a real workspace, or disable yolo to test approvals. */
  server?: ScenarioServerOptions;
  run: (ctx: ScenarioContext) => Promise<void>;
  verifyAimockRequests?: (requests: unknown[]) => void;
}

export async function runScenario(scenario: WebScenario): Promise<void> {
  const aimock = await startAimock(scenario.aimockFixture);
  const server = await startAgentControllerServer(aimock.baseUrl, scenario.server);
  const driver = await createDriver({
    baseUrl: server.baseUrl,
    fetch: server.fetch,
    resourceId: scenario.resourceId ?? `web-scenario-${scenario.name}`,
  });

  try {
    await scenario.run({
      driver,
      aimockRequests: aimock.requests,
      fetch: server.fetch,
      baseUrl: server.baseUrl,
      workspaceRoot: server.workspaceRoot,
    });
    if (aimock.requestCount() === 0) {
      throw new Error(`${scenario.name} expected at least one AIMock request but saw none`);
    }
    scenario.verifyAimockRequests?.(aimock.requests());
  } finally {
    await driver.dispose();
    await server.stop();
    await aimock.stop();
  }
}
