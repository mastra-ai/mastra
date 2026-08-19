import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';

export default function currentFixture(pi) {
  pi.registerTool(
    defineTool({
      name: 'current_fixture',
      label: 'Current fixture',
      description: 'Current import fixture',
      parameters: Type.Object({ value: Type.String() }),
      execute: async () => ({ content: [{ type: 'text', text: 'ok' }], details: {} }),
    }),
  );
}
