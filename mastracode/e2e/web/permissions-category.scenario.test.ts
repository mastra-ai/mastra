import { describe, it } from 'vitest';

import type { WebScenario } from './scenario-runner';
import { runScenario } from './scenario-runner';

/**
 * Exercises the exact path the Settings → Behavior → Tool permissions UI drives:
 * setPermissionForCategory(category, policy) followed by getPermissions(). The
 * web PermissionsSection reads categories on open and writes them per-segment,
 * so this guards that per-category round-trip end to end through the adapter.
 */
const scenario: WebScenario = {
  name: 'permissions-category',
  description: 'Sets per-category permission policies and reads them back through the harness routes.',
  aimockFixture: 'automated-chat.json',
  server: { yolo: false },
  run: async ({ driver }) => {
    const session = driver.getClient().getAgentController('code').session(`web-scenario-${scenario.name}`);

    await session.setPermissionForCategory('execute', 'deny');
    await session.setPermissionForCategory('edit', 'ask');
    await session.setPermissionForCategory('read', 'allow');

    const rules = await session.getPermissions();
    const got = rules.categories ?? {};
    const expected = { execute: 'deny', edit: 'ask', read: 'allow' } as const;
    for (const [category, policy] of Object.entries(expected)) {
      if (got[category as keyof typeof got] !== policy) {
        throw new Error(`Expected ${category}=${policy}, got ${got[category as keyof typeof got]}`);
      }
    }

    // The scenario harness requires at least one model turn; this also proves
    // the category writes above don't disrupt a normal run.
    await driver.submit('Say the smoke phrase');
    await driver.waitForText('WEB scenario smoke response');
  },
};

describe(`web scenario: ${scenario.name}`, () => {
  it(scenario.description, () => runScenario(scenario));
});
