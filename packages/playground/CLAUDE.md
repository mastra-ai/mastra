# Local Studio Standards

Standards and conventions for building the local studio in `packages/playground`.

## MUST DO EVERY SINGLE TIME

On every change to this package, you MUST ALWAYS follow these instructions:

- use `playground-msw-tests` skill — PRIMARY testing strategy for this package
- use `e2e-tests-studio` skill — only when MSW cannot model the journey
- use `react-best-practices` skill
- use `playground-ui-styling` and `tailwind-v4` skills

## Testing Priority (highest first)

1. **Vitest + MSW + typed `@mastra/client-js` fixtures** — `playground-msw-tests`
   skill. This is the #1 way to test this package. Cover hooks, pages, redirect
   logic, gating, data-fetching, and React Query flows here.
2. **Playwright E2E** — `e2e-tests-studio` skill. Use only for cross-page user
   journeys, real Mastra server interactions (streaming, workflow execution),
   or genuine browser concerns that MSW cannot model.

Rules:

- Drive the real `@mastra/client-js` + React Query stack. Only mock the network.
- **Never** `vi.mock` our own data hooks, services, or auth gating.
- Fixtures MUST be typed with response types re-exported from `@mastra/client-js`
  and live in a nearby `__tests__/fixtures/` folder. No `as any`, no bespoke
  inline types.

## Commands

### Local Commands (run from `packages/playground`)

- `pnpm dev`: Start Vite development server
- `pnpm build`: Build the playground with Vite
- `pnpm build:watch`: Build in watch mode
- `pnpm preview`: Preview the production build
- `pnpm lint`: Run ESLint

### Root Commands (run from monorepo root)

- `pnpm dev:playground`: Start dev servers for playground, playground-ui, and react client SDK
- `pnpm build:cli`: Build the CLI (includes playground and playground-ui as dependencies)

## Package Architecture

### Scope

`packages/playground` is a local development studio built with React Router that composes primitives from `packages/playground-ui`.

### Responsibilities

- **Route Configuration**: Define React Router routes and pages
- **Component Composition**: Assemble pages using `packages/playground-ui` primitives
- **Integration Components**: Components that wrap external SDKs (e.g. `@mcp-ui/client`) live here in `src/domains/` rather than in `playground-ui`, to keep the shared component library free of heavy third-party dependencies

## Key Principles

- This package is primarily **composition** — prefer `playground-ui` for general UI components
- Integration-specific components (wrapping external SDKs like `@mcp-ui/client`) belong in `src/domains/` here
- All general-purpose UI components and data-fetching hooks should come from `packages/playground-ui`
- Pages should be thin wrappers around `playground-ui` components
- When in doubt about general UI, add functionality to `playground-ui` instead
