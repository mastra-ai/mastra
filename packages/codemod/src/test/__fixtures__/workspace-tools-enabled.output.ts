import { Workspace, LocalFilesystem, LocalSandbox } from '@mastra/core/workspace';

// Case 1: No tools config at all — should add tools: { enabled: true }
const workspace1 = new Workspace({
  filesystem: new LocalFilesystem({ basePath: './data' }),

  tools: {
    enabled: true,
  },
});

// Case 2: Has tools but no enabled — should add enabled: true
const workspace2 = new Workspace({
  filesystem: new LocalFilesystem({ basePath: './data' }),
  tools: {
    enabled: true,
    requireApproval: true,
  },
});

// Case 3: Already has tools.enabled: false — leave alone
const workspace3 = new Workspace({
  filesystem: new LocalFilesystem({ basePath: './data' }),
  tools: {
    enabled: false,
  },
});

// Case 4: Already has tools.enabled: true — leave alone
const workspace4 = new Workspace({
  filesystem: new LocalFilesystem({ basePath: './data' }),
  tools: {
    enabled: true,
    requireApproval: true,
  },
});

// Case 5: Multiple config properties, no tools — should add
const workspace5 = new Workspace({
  filesystem: new LocalFilesystem({ basePath: './data' }),
  sandbox: new LocalSandbox({ workingDirectory: './data' }),

  tools: {
    enabled: true,
  },
});

// Case 6: tools with per-tool overrides but no top-level enabled — should add
const workspace6 = new Workspace({
  filesystem: new LocalFilesystem({ basePath: './data' }),
  tools: {
    enabled: true,

    mastra_workspace_write_file: {
      requireApproval: true,
    },
  },
});
