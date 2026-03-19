import { Workspace } from '@mastra/core/workspace';
import { LocalFilesystem } from '@mastra/core/workspace';
import { createWorkspaceTools } from '@mastra/core/workspace';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';

const require = createRequire(import.meta.url);

// Check if @ast-grep/napi is resolvable (it should NOT be in this fixture)
let napiResolvable = false;
try {
  require.resolve('@ast-grep/napi');
  napiResolvable = true;
} catch {}

const tempDir = await mkdtemp(join(tmpdir(), 'workspace-tools-test-'));
const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: tempDir }),
});
const tools = createWorkspaceTools(workspace);
const toolNames = Object.keys(tools).sort();

console.log(JSON.stringify({ toolNames, napiResolvable }));
