# AGENTS.md

## Scope

This file applies to work in `packages/auth/`.

## Commands

- Build from root: `pnpm build:auth`
- Test from root: `pnpm --filter ./packages/auth test`
- For broader auth coverage, use `pnpm test:auth`

## Test shape

- Most validation is package-scoped tests plus build output

## Notes

- Be careful when changing JWT parsing, signing, or JWKS behavior
