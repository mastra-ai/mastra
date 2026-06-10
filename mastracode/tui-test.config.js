const parsedJobs = Number.parseInt(process.env.MC_E2E_JOBS ?? '', 10);
const workers = Number.isInteger(parsedJobs) && parsedJobs > 0 ? parsedJobs : 1;

export default {
  testMatch: 'scripts/mc-e2e/tui.test.ts',
  workers,
};
