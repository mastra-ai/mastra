Build from root: pnpm build:cli
Test from root: pnpm test:cli
Typecheck from root: pnpm --filter ./packages/cli typecheck

Most validation is package-scoped tests plus CLI typecheck/build checks

Preserve stable CLI behavior
