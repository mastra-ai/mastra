---
name: playground-msw-tests
description: >
  REQUIRED and PRIMARY testing approach for packages/playground and packages/playground-ui.
  Triggers on: adding or modifying hooks, pages, route components, data-fetching code,
  React Query interactions, or any test work in these packages. Generates Vitest tests
  that drive the real @mastra/client-js + React Query stack through MSW handlers and
  typed fixtures derived from @mastra/client-js response types. This is the #1 way to
  test the playground packages — ABOVE Playwright E2E. Use Playwright only for
  cross-page user journeys that MSW cannot model.
---

# MSW + client-js Fixtures: Primary Testing Strategy

## Core Principle

**Drive the real transport, mock the network.**

Tests in `packages/playground` and `packages/playground-ui` MUST be written as
Vitest tests that exercise the real `@mastra/client-js` SDK, the real React Query
cache, and the real component/hook code paths. The only seam we mock is the
network boundary, via [MSW](https://mswjs.io/).

This catches contract drift between the playground and `@mastra/client-js` at
typecheck time and at test time — something `vi.mock('@/hooks/...')` style tests
cannot do.

## Priority Order

When you write or refactor a test for these packages, choose in this order:

1. **MSW + typed client-js fixtures (THIS SKILL)** — for hooks, pages, routes,
   data-fetching, gating, redirect logic, query/mutation flows, error paths.
2. **Playwright E2E** (`e2e-tests-studio` skill) — only for genuine cross-page
   user journeys, real browser concerns (focus/keyboard/viewport), or anything
   that requires a real running Mastra server.
3. **Pure unit tests** — only for self-contained utilities/services with no
   network, no React Query, no router involvement.

If the same behavior can be covered by both #1 and #2, **prefer #1**. MSW tests
are faster, deterministic, run in CI without browsers, and assert the real wire
contract.

## What NOT to do

- ❌ `vi.mock('@/domains/.../hooks/use-agents')` — mocking our own hooks hides
  cache, gating and transport bugs.
- ❌ Inline TypeScript types in tests (`type AgentLite = { id: string }`) —
  these drift silently from the real SDK.
- ❌ `as any` / `as unknown as ListAgentsResponse` on fixture data.
- ❌ Returning bespoke shapes from MSW handlers that don't match the real
  `@mastra/client-js` response. If a field is optional, include it as optional
  in the fixture, don't omit the type.

## What TO do

- ✅ Put fixtures in a `__tests__/fixtures/` folder next to the test file.
- ✅ Type every fixture with a response type re-exported from `@mastra/client-js`
  (e.g. `ListStoredAgentsResponse`, `GetAgentResponse`, `BuilderSettingsResponse`,
  `GetToolResponse`, `GetWorkflowResponse`, `ListStoredSkillsResponse`).
- ✅ Register MSW handlers per test with `server.use(...)` so handlers reset
  between tests via the global `afterEach`.
- ✅ Render through `MastraReactProvider` + `QueryClientProvider` + `MemoryRouter`
  so the real client SDK is the transport.
- ✅ Use `vi.fn()` wrappers inside MSW handlers to assert which endpoints were
  hit (great for testing `enabled: ...` gating without mocking hooks).

## Standard Test Skeleton

```tsx
// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '@/test/msw-server';
import { Subject } from '../subject';
import { happyPathResponse } from './fixtures/subject';

const BASE_URL = 'http://localhost:4111';

const renderSubject = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Subject />
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

afterEach(() => cleanup());

describe('Subject', () => {
  it('renders the happy path', async () => {
    server.use(http.get(`${BASE_URL}/api/agents`, () => HttpResponse.json(happyPathResponse)));

    renderSubject();

    expect(await screen.findByText('Expected behavior')).not.toBeNull();
  });
});
```

## Standard Fixture File

```ts
// packages/playground/src/.../__tests__/fixtures/subject.ts
import type { ListStoredAgentsResponse } from '@mastra/client-js';

export const emptyStoredAgents: ListStoredAgentsResponse = {
  agents: [],
  total: 0,
  page: 1,
  perPage: 50,
  hasMore: false,
};

export const oneDraftAgent: ListStoredAgentsResponse = {
  ...emptyStoredAgents,
  agents: [
    {
      id: 'agent-1',
      name: 'Draft Agent',
      instructions: '',
      model: { provider: 'openai', name: 'gpt-4o-mini' },
      status: 'draft',
      // ...other required fields from StoredAgentResponse
    },
  ],
  total: 1,
};
```

**If a required field on the SDK response type is missing from your fixture,
that's a real test failure — fix the fixture, never `as any` it.**

## Existing Infrastructure to Reuse

- `packages/playground/src/test/msw-server.ts` — exports `server`. The global
  `vitest.setup.ts` calls `server.listen({ onUnhandledRequest: 'error' })`,
  `server.resetHandlers()` after each test, and `server.close()` at the end.
  This means **unhandled requests fail tests loudly** — that's the contract.
- `packages/playground/vitest.setup.ts` — already wires MSW lifecycle, jsdom
  polyfills (`matchMedia`, `Element.prototype.scrollTo`), so test files just
  add their own `server.use(...)` per case.

## Recipes

### Test loading state without mocking hooks

Defer the MSW handler's resolution with a promise gate:

```ts
const gate = (() => {
  let resolve: () => void = () => {};
  const promise = new Promise<void>(r => {
    resolve = r;
  });
  return { promise, resolve };
})();

server.use(
  http.get(`${BASE_URL}/api/stored/agents`, async () => {
    await gate.promise;
    return HttpResponse.json(emptyStoredAgents);
  }),
);

renderSubject();
expect(screen.getByTestId('spinner')).not.toBeNull();

gate.resolve();
await waitFor(() => expect(screen.queryByTestId('spinner')).toBeNull());
```

### Assert that a query is gated (`enabled: false`)

Wrap the handler in a `vi.fn` and assert it was never called:

```ts
const onAgents = vi.fn<() => void>();
server.use(
  http.get(`${BASE_URL}/api/agents`, () => {
    onAgents();
    return HttpResponse.json(emptyAgents);
  }),
);

renderSubject(); // user has no write access → hook should not fire

await new Promise(resolve => setTimeout(resolve, 50));
expect(onAgents).not.toHaveBeenCalled();
```

### Assert per-feature-flag gating

Use a single MSW handler per endpoint and one `vi.fn` per endpoint, then
toggle the builder-settings response to flip features on/off and assert which
handlers were hit.

### Vary response by query string

Read `request.url` inside the handler:

```ts
server.use(
  http.get(`${BASE_URL}/api/stored/agents`, ({ request }) => {
    const status = new URL(request.url).searchParams.get('status');
    return HttpResponse.json(status === 'draft' ? oneDraftAgent : emptyStoredAgents);
  }),
);
```

### Thin component seams that ARE acceptable to mock

You may replace these with very thin stubs:

- A heavy child component that has its OWN dedicated test (e.g. mock
  `AgentBuilderStarter` to `<div data-testid="agent-builder-starter" />`).
- `react-router`'s `Navigate` so you can assert the redirect target instead
  of letting it actually navigate.
- `Button` / `Spinner` style atoms from `@mastra/playground-ui` only when the
  real component requires more global context than the test needs.

**Never** mock our own data hooks, services, or auth gating logic — drive those
through their real implementations against MSW.

## Verification Checklist

Before considering a test done:

- [ ] All fixtures import a type from `@mastra/client-js` and have no `as any`
      / `as unknown as` casts.
- [ ] No `vi.mock` of `@/domains/.../hooks/*`, `@/domains/.../services/*`,
      `@mastra/client-js`, or `@mastra/react`.
- [ ] `pnpm --filter ./packages/playground typecheck` passes — proves fixtures
      conform to the live SDK shape.
- [ ] The new test runs in isolation AND as part of the package suite without
      `onUnhandledRequest: 'error'` failures.
- [ ] Coverage for the file under test is at the target level (usually 100%
      for hooks/pages, since MSW makes every branch reachable).

## When to Reach for Playwright Instead

Reach for `e2e-tests-studio` only when at least one is true:

- The behavior spans multiple pages with real navigation/history.
- The behavior requires a real Mastra server (streaming, workflow execution,
  real model providers).
- The behavior is fundamentally a browser concern (drag-drop, focus traps,
  viewport, file uploads).

Everything else — fetching, caching, redirects, gating, optimistic updates,
error states, empty states, pagination, search params — belongs in this skill.
