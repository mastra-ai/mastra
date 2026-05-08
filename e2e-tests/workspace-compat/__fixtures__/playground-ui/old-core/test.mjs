import { isWorkspaceV1Supported } from '@mastra/playground-ui/utils';
import { MastraClient } from '@mastra/client-js';
import { coreFeatures } from '@mastra/core/features';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Log resolved package versions
const corePackage = require('@mastra/core/package.json');
const clientPackage = require('@mastra/client-js/package.json');
const playgroundPackage = require('@mastra/playground-ui/package.json');

const client = new MastraClient({ baseUrl: 'http://localhost:4111' });

// Test the actual isWorkspaceV1Supported function
const isSupported = isWorkspaceV1Supported(client);

// Output JSON for parsing
console.log(
  JSON.stringify({
    versions: {
      core: corePackage.version,
      clientJs: clientPackage.version,
      playgroundUi: playgroundPackage.version,
    },
    coreFeatures: Array.from(coreFeatures),
    hasWorkspacesV1: coreFeatures.has('workspaces-v1'),
    clientMethods: {
      listWorkspaces: typeof client.listWorkspaces === 'function',
      getWorkspace: typeof client.getWorkspace === 'function',
    },
    isSupported,
  }),
);
