export default {
  testMatch: 'scripts/mc-e2e/tui.test.ts',
  workers: Number(process.env.MC_E2E_JOBS ?? 1),
};
