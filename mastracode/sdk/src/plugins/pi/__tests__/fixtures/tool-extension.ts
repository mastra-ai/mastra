import { Type } from 'typebox';

export default function toolExtension(pi: {
  registerTool(tool: {
    name: string;
    label: string;
    description: string;
    parameters: unknown;
    execute: (...args: unknown[]) => unknown;
    renderResult: (...args: unknown[]) => unknown;
  }): void;
}) {
  pi.registerTool({
    name: 'pi_fixture_echo',
    label: 'Pi fixture echo',
    description: 'Echoes text through the Pi compatibility adapter',
    parameters: Type.Object({ text: Type.String({ description: 'Text to echo' }) }),
    execute: async (_toolCallId, params, _signal, onUpdate) => {
      (onUpdate as (value: unknown) => void)({ content: [{ type: 'text', text: 'fixture progress' }] });
      return {
        content: [{ type: 'text', text: `fixture result: ${(params as { text: string }).text}` }],
        details: { fixture: true },
      };
    },
    renderResult: () => ({ unsupportedFixtureNode: true }),
  });
}
