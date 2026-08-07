import { LocalFilesystem, Workspace } from '@mastra/core/workspace';

export const workspace = new Workspace({
  id: 'builder-workspace',
  name: 'Builder Workspace',
  filesystem: new LocalFilesystem({ basePath: '.mastra/workspace' }),
});
