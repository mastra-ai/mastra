Build from root: pnpm build:auth
Test from root: pnpm --filter ./packages/auth test
For broader auth coverage, use pnpm test:auth

Most validation is package-scoped tests plus build output

Be careful when changing JWT parsing, signing, or JWKS behavior
