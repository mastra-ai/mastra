# Local Studio Standards

Standards and conventions for building the local studio in `packages/playground`.

## MUST DO EVERY SINGLE TIME

On every change to this package, you MUST ALWAYS follow these instructions:

- use `e2e-frontend-validation` skill
- use `react-best-practices` skill
- use `tailwind-best-practices` skill

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
