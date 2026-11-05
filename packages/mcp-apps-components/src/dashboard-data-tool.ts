// The only entry that imports @mastra/server, so hosts that answer the data tool themselves
// can use `./dashboard-renderer` without it.
export { DASHBOARD_DATA_ROUTES, dashboardDataTool } from './apps/dashboard-renderer/data-tool';
