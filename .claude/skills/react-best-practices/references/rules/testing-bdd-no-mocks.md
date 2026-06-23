---
title: BDD Tests That Mock Only the Network
impact: MEDIUM-HIGH
impactDescription: mocking our own hooks/services/auth gating hides cache, transport, and gating bugs; flat imperative tests are hard to read and let untested branches hide
tags: testing, bdd, mocking, msw, vitest
---

## BDD Tests That Mock Only the Network

In `packages/playground` (and `packages/playground-ui`), tests must **drive the real `@mastra/client-js` + React Query stack and only mock the network**, and they must be written **BDD-style**: an outer `describe` names the unit, inner `describe('when …')` blocks name a precondition, and each `it` asserts one outcome.

This rule is **lint-enforced**. `packages/playground/eslint.config.js` adds `no-restricted-syntax` selectors (scoped to `src/**/*.{test,spec}.{ts,tsx}`) that fail CI on any prohibited `vi.mock`. The contract also lives in `packages/playground/AGENTS.md`, and the mechanics live in the `playground-msw-tests` skill — activate it before adding or changing any test here.

### The no-mock rule

**Prohibited** — `vi.mock` of:

- our own data hooks/services: `@/domains/**/hooks/*`, `@/domains/**/services/*`, `@/hooks/*` (and relative paths to the same)
- auth gating: `@/domains/auth/**`
- domain barrels that re-export the above: `@/domains/{agent-builder,llm,agents}`
- the SDK: `@mastra/client-js`, `@mastra/react`

Mocking these replaces the very code paths a test should exercise — the React Query cache, the SDK transport, RBAC capability resolution — with a fiction. A green test then proves nothing about production behavior.

**Allowed seams** (not flagged):

- MSW network handlers (this is how you control inputs)
- jsdom DOM-API polyfills in `vitest.setup.ts`
- `react-router`'s `Navigate` (to assert a redirect target)
- a thin stub of a heavy child component **that has its own dedicated test**
- atoms that need global context

**Incorrect (mocks auth gating and the SDK; asserts nothing real):**

```tsx
vi.mock('@mastra/react', () => ({
  useMastraClient: () => ({ getBuilderSettings }),
}));
vi.mock('@/domains/auth/hooks/use-permissions', () => ({
  usePermissions: () => ({ hasPermission: () => true, rbacEnabled: true }),
}));

it('shows the editor for permitted users', () => {
  render(<AgentEditPage />);
  expect(screen.getByRole('form')).toBeInTheDocument();
});
```

**Correct (real providers + SDK; capability + data driven by MSW fixtures):**

```tsx
// __tests__/fixtures/capabilities.ts — typed from @mastra/client-js, no `as any`
import type { GetCapabilitiesResponse } from '@mastra/client-js';

export const canEditAgents: GetCapabilitiesResponse = {
  /* … real-shaped capability payload granting agent edit … */
};

// agent-edit.msw.test.tsx
describe('AgentEditPage', () => {
  describe('when the user has the agent-edit capability', () => {
    it('renders the editor form', async () => {
      server.use(http.get('*/api/auth/capabilities', () => HttpResponse.json(canEditAgents)));

      renderWithProviders(<AgentEditPage />);

      expect(await screen.findByRole('form')).toBeInTheDocument();
    });
  });

  describe('when the user lacks the capability', () => {
    it('redirects to the first accessible route', async () => {
      server.use(http.get('*/api/auth/capabilities', () => HttpResponse.json(noCapabilities)));

      renderWithProviders(<AgentEditPage />);

      expect(await screen.findByTestId('navigate')).toHaveAttribute('data-to', '/agents');
    });
  });
});
```

### BDD structure

- **Outer `describe`** = the unit under test (the hook, component, or function).
- **Inner `describe('when <context>')`** = one precondition: an input shape, an RBAC capability, a feature flag, or a loading/error/empty/success state — each set up with a **real MSW fixture**, never a mocked hook.
- **`it('<outcome>')`** = one Then. Split multi-assert cases into separate `it`s so a failure names the exact broken outcome.
- Keep single-context units **flat** — don't nest `when` blocks for their own sake.

Fixtures live in a nearby `__tests__/fixtures/` folder, typed with response types re-exported from `@mastra/client-js`. No bespoke inline types, no `as any`, no `as unknown as`.

When removing a mock surfaces a real product gap (an endpoint with no handler, a gating branch that was never exercised), fix the test/fixture or file the gap — never re-mock to paper over it. MSW runs with `onUnhandledRequest: 'error'`, so an unstubbed request fails loudly on purpose.
