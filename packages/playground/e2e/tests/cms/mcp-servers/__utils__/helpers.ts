import type { Locator, Page } from '@playwright/test';

const PORT = process.env.E2E_PORT || '4111';
const BASE_URL = `http://localhost:${PORT}`;

export function uniqueServerName(prefix = 'Test Server') {
  return `${prefix} ${Date.now().toString(36)}`;
}

export function getToolSwitch(container: Locator, toolName: string): Locator {
  return container.locator('div:has(> [role="switch"])').filter({ hasText: toolName }).getByRole('switch');
}

export async function createMCPServerViaAPI(params: {
  name: string;
  version: string;
  tools?: Record<string, { description?: string }>;
}): Promise<{ id: string; name: string; version: string }> {
  const res = await fetch(`${BASE_URL}/api/stored/mcp-servers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    throw new Error(`Failed to create MCP server: ${res.statusText}`);
  }

  return res.json();
}

export async function fillMCPServerFields(page: Page, options: { name?: string; version?: string }) {
  if (options.name !== undefined) {
    const nameInput = page.locator('#mcp-server-name');
    await nameInput.clear();
    await nameInput.fill(options.name);
  }

  if (options.version !== undefined) {
    const versionInput = page.locator('#mcp-server-version');
    await versionInput.clear();
    await versionInput.fill(options.version);
  }
}
