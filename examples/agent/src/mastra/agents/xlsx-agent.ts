import { Agent } from '@mastra/core/agent';
import { WorkspaceAttachmentsProcessor } from '@mastra/core/processors';
import { Workspace } from '@mastra/core/workspace';
import { E2BSandbox } from '@mastra/e2b';
import { Memory } from '@mastra/memory';

// No filesystem: spreadsheet attachments are written straight into the E2B VM (uploads/<id>/<name>).
const workspace = new Workspace({
  sandbox: new E2BSandbox({
    id: 'xlsx-agent-example',
    apiKey: process.env.E2B_API_KEY,
  }),
  // Ships a minimal `xlsx` reader skill. For a fuller one: `npx skills add anthropics/skills --skill xlsx`.
  skills: ['workspace/.agents/skills'],
});

export const xlsxAgent = new Agent({
  id: 'xlsx-agent',
  name: 'XLSX Agent',
  description: 'Reads and analyses spreadsheet attachments by running Python in an E2B sandbox.',
  instructions: `
    You analyse spreadsheets that users attach.
    .xlsx and .xls attachments are uploaded into the sandbox; the message tells you the path.
    .csv attachments arrive inline in the message as text.
    Run Python in the sandbox with pandas/openpyxl to read it. If an import fails, pip install the package and retry.
    Answer with the actual data you read, and say which sheets and ranges you looked at.
  `,
  model: 'openai/gpt-5-mini',
  workspace,
  // Models can't read spreadsheet binaries: route them to the workspace instead.
  inputProcessors: [
    new WorkspaceAttachmentsProcessor({
      extensions: ['.xlsx', '.xls'],
      mimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
    }),
  ],
  memory: new Memory({
    options: {
      lastMessages: 20,
      workingMemory: { enabled: true },
    },
  }),
});
