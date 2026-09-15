# Deployer validation

Build from root: pnpm build:deployer
Test from root: pnpm test:deployer

Every change under packages/deployer/ must include corresponding coverage under e2e-tests/monorepo/. The deployer build pipeline generates monorepo applications and package unit tests alone do not validate that output. The changed-test-gate workflow enforces this: a PR touching packages/deployer/ without also touching e2e-tests/monorepo/ will fail.

Run the monorepo E2E suite from root: pnpm --filter ./e2e-tests/monorepo test
