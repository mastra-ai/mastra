# Frontend Component Standards

Standards and conventions for building components in `packages/playground-ui`.

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

## MUST DO EVERY SINGLE TIME

On every change to this package, you MUST ALWAYS follow these instructions:

- use `e2e-frontend-validation` skill
- use `react-best-practices` skill
- use `tailwind-best-practices` skill
