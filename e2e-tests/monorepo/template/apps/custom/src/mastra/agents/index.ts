import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { MastraBrowser } from '@mastra/core/browser';
import { LocalFilesystem, Workspace } from '@mastra/core/workspace';
import { tmpdir } from 'os';
import { toolUsingNativeBindings, toolWithNativeBindingPackageDep } from '@inner/inner-tools';
import { lodashTool } from '@/tools/lodash';
import { calculatorTool } from '@/tools/calculator-tool';
import { helloWorldTool } from '@inner/hello-world';

export const innerAgent = new Agent({
  id: 'inner-agent',
  name: 'Inner Agent',
  instructions: 'You are a helpful assistant.',
  model: openai('gpt-4o'),
  tools: { helloWorldTool, lodashTool, toolUsingNativeBindings, toolWithNativeBindingPackageDep, calculatorTool },
});

// Minimal CLI browser provider stub. CLI providers expose no SDK tools by design —
// the browser lives on the workspace, so serialized agents must report hasBrowser
// through the workspace, not through browserTools.
class E2ECliBrowser extends MastraBrowser {
  readonly id = 'e2e-cli-browser';
  readonly name = 'E2E CLI Browser';
  readonly provider = 'e2e';
  override readonly providerType = 'cli' as const;

  protected async doLaunch(): Promise<void> {}
  protected async doClose(): Promise<void> {}
  protected async getActivePage(): Promise<{ url(): string } | null> {
    return null;
  }
  protected getBrowserStateForThread(): null {
    return null;
  }
  getTools() {
    return {};
  }
}

export const browserAgent = new Agent({
  id: 'browser-agent',
  name: 'Browser Agent',
  instructions: 'You are a helpful assistant with a workspace browser.',
  model: openai('gpt-4o'),
  workspace: new Workspace({
    id: 'browser-workspace',
    filesystem: new LocalFilesystem({ basePath: tmpdir() }),
    browser: new E2ECliBrowser(),
  }),
});
