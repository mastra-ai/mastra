export default {
  testMatch: 'scripts/mc-e2e/tui-shard-*.test.ts',
  workers: Number(process.env.MC_E2E_JOBS ?? 1),
  timeout: 60_000,
};
