import { readServerConfig, readIntegrationConfig, hasEnabledIntegration } from '../src/env.js';
import { validateStartupConfiguration } from '../src/config/startup.js';
import { prepareDevelopmentDatabase } from '../src/dev-database.js';
import { startDevelopment, assertDevelopmentPortAvailable } from '../src/dev-supervisor.js';

validateStartupConfiguration();
const server = readServerConfig();
const integrations = readIntegrationConfig();
await assertDevelopmentPortAvailable(server.port);
if (server.mode === 'local' && !hasEnabledIntegration(integrations)) {
  await prepareDevelopmentDatabase();
}
await startDevelopment({ installSignalHandlers: true });
