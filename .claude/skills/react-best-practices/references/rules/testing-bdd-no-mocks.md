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

export const canEditAgents: GetCapabilitiesResponse = {/* … real-shaped capability payload granting agent edit … */};

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
- Avoid implementation-mirror tests: do not duplicate source class strings, branch logic, generated shapes, or calculations unless the assertion protects a real behavior or regression.
- For class-name assertions specifically, use `testing-no-classname-assertions`: prefer computed style, user-visible behavior, or browser validation over duplicating visual implementation tokens.
- Keep single-context units **flat** — don't nest `when` blocks for their own sake.

Fixtures live in a nearby `__tests__/fixtures/` folder, typed with response types re-exported from `@mastra/client-js`. No bespoke inline types that drift from the SDK.

Keep the real hook/component import in the test so production boundary types (SDK, hook, component, DOM, Testing Library) flow through — do not force fixture, MSW response, or payload compatibility with `as`. Casts are prohibited in tests too; see `types-no-type-assertions` for the guards, query generics, and typed factories to use instead.

When removing a mock surfaces a real product gap (an endpoint with no handler, a gating branch that was never exercised), fix the test/fixture or file the gap — never re-mock to paper over it. MSW runs with `onUnhandledRequest: 'error'`, so an unstubbed request fails loudly on purpose.

### Wrap mutation calls in `act`

When a `renderHook` test fires a mutation (or any call that triggers React state updates outside an event handler), wrap it in `await act(...)`. Awaiting `mutateAsync` alone is not enough: the mutation resolves, but React Query's observer notifications (and any chained mutations like a best-effort workspace write) settle in a later microtask, producing "An update to TestComponent inside a test was not wrapped in act(...)" and, under jsdom teardown, flaky `window is not defined` errors.

**Incorrect (bare `mutateAsync`; trailing state update escapes `act`):**

```tsx
const { result } = renderHookWithProviders(() => useCreateSkill());
await waitFor(() => expect(result.current.permissions.isLoading).toBe(false));
await result.current.create.mutateAsync({ name: 'n', files });
```

**Correct (mutation wrapped, then drain React Query):**

```tsx
const { result, queryClient } = renderHookWithProviders(() => useCreateSkill());
await waitFor(() => expect(result.current.permissions.isLoading).toBe(false));
await act(async () => {
  await result.current.create.mutateAsync({ name: 'n', files });
});
await waitForMutationsIdle(queryClient);
```

### Hooks don't own UI toasts

Data hooks return state; **components own user-facing feedback**. A hook's `onError` must not call `toast.error(...)` — that couples a reusable hook to a specific UI surface, fires duplicate toasts when several callers wrap the same hook, and makes errors invisible to non-UI callers (e.g. a tool's `execute` that surfaces the failure to the agent). Let the mutation reject and toast at the component boundary in a `try/catch` around `mutateAsync`. This also keeps tests honest: a real-stack test asserts the rejection, not a spied toast.
