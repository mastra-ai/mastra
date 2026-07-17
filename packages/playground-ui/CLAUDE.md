# Frontend Component Standards

Standards and conventions for building components in `packages/playground-ui`.

## MUST DO EVERY SINGLE TIME

On every change to this package, you MUST ALWAYS follow these instructions:

- use `playground-msw-tests` skill — PRIMARY testing strategy for components and hooks
- use `e2e-tests-studio` skill — only when MSW cannot model the journey
- use `react-best-practices` skill
- use `mastra-frontend` and `tailwind-v4` skills

## Testing Priority (highest first)

1. **Vitest + MSW + typed `@mastra/client-js` fixtures** — `playground-msw-tests`
   skill. This is the #1 way to test this package. Cover business hooks, data
   components, gating, and React Query flows here. The same rules apply as in
   `packages/playground`: drive the real client SDK, only mock the network,
   never mock our own hooks, and type every fixture from `@mastra/client-js`.
2. **Playwright E2E** — `e2e-tests-studio` skill. Use only when MSW cannot
   model the journey.

## Commands

### Local Commands (run from `packages/playground-ui`)

- `pnpm build`: TypeCheck and build the package with Vite
- `pnpm dev`: Build in watch mode
- `pnpm test`: Run tests with Vitest
- `pnpm preview`: Preview the production build
- `pnpm storybook`: Start Storybook dev server on port 6006
- `pnpm build-storybook`: Build Storybook for production

### Root Commands (run from monorepo root)

- `pnpm dev:playground`: Start dev servers for playground, playground-ui, and react client SDK
- `pnpm build:cli`: Build the CLI (includes playground and playground-ui as dependencies)

## Package Architecture

### Scope

`packages/playground-ui` provides shared UI and business logic primitives for multiple studio environments.

### Target Environments

- **Local Studio**: Development server using React Router
- **Cloud Studio**: Production SaaS using Next.js

### Responsibilities

- **UI Components**: Reusable presentational components
- **Business Hooks**: Data-fetching and state management (`src/domains`)
  - Examples: `useAgents()`, `useWorkflows()`
- **Business Components**: Domain-specific components (`src/domains`)
  - Examples: `<AgentsTable>`, `<AgentInformation>`

## Key Principles

- All components must work in both React Router and Next.js
- Keep business logic in `src/domain` sub-folders
- Maintain environment-agnostic design
- Prioritize design system tokens for consistency
- Minimize side effects and state management
- Use TanStack Query for all server state
