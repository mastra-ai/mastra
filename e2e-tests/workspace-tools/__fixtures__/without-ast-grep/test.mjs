import { Workspace } from '@mastra/core/workspace';
import { LocalFilesystem } from '@mastra/core/workspace';
import { createWorkspaceTools } from '@mastra/core/workspace';
import { tmpdir } from 'os';
import { mkdtemp } from 'fs/promises';
import { join } from 'path';

const tempDir = await mkdtemp(join(tmpdir(), 'workspace-tools-test-'));
const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: tempDir }),
});
const tools = createWorkspaceTools(workspace);
const toolNames = Object.keys(tools).sort();

console.log(JSON.stringify({ toolNames }));
