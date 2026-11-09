import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { describe, expect, it } from 'vitest';
import { tripArgs, tripCatalog } from './catalog.mock';
import { createGenUIDefinition, createSpecResolver, createSpecTools } from './index';
import type { CreateGenUIDefinitionOptions, GenUISpecResolver, GenUISpecTool } from './index';

const message = (id: string, parts: object[]): MastraDBMessage => ({
  id,
  role: 'assistant',
  createdAt: new Date(0),
  threadId: 'thread-1',
  resourceId: 'resource-1',
  content: { format: 2, parts: parts as MastraDBMessage['content']['parts'] },
});

const specCall = (toolCallId: string, args: object, result: object = { ok: true, id: toolCallId }) => ({
  type: 'tool-invocation',
  toolInvocation: { state: 'result', toolCallId, toolName: 'ui_spec', args, result },
});

const retitle = (title: string, target?: string) => ({
  ...(target ? { target } : {}),
  mode: 'patch',
  patch: [{ op: 'replace', path: '/elements/card/props/title', value: JSON.stringify(title) }],
});

function setup(specTool: CreateGenUIDefinitionOptions['specTool'] = true, resolver?: GenUISpecResolver) {
  const definition = createGenUIDefinition({ catalog: tripCatalog, specTool });
  const tools = createSpecTools({ definition, ...(resolver ? { resolver } : {}) });
  const tool = (name: string): GenUISpecTool => {
    const found = tools.find(entry => entry.name === name);
    if (!found) throw new Error(`no tool "${name}"`);
    return found;
  };
  return { tools, tool };
}

describe('createSpecTools', () => {
  describe('when the definition has no spec tool', () => {
    it('offers no tools', () => {
      expect(setup(false).tools).toEqual([]);
    });
  });

  describe('when the spec tool is on with its defaults', () => {
    it('offers the spec tool and a patch-only edit tool', () => {
      const { tools, tool } = setup();

      expect(tools.map(entry => entry.name)).toEqual(['ui_spec', 'ui_spec_edit']);
      expect(JSON.stringify(tool('ui_spec_edit').inputSchema)).not.toContain('"merge"');
    });

    it('tells the model which components and actions it may use', () => {
      const { description } = setup().tool('ui_spec');

      expect(description).toContain('- Card: A titled card');
      expect(description).toContain('- Toggle: An on/off switch');
      expect(description).toContain('App actions: book');
    });

    it('accepts a valid spec and echoes the call id', async () => {
      const result = await setup().tool('ui_spec').execute(tripArgs, { toolCallId: 's1' });

      expect(result).toEqual({ ok: true, id: 's1' });
    });

    it('rejects a component that is not in the catalog', async () => {
      const args = { ...tripArgs, elements: [{ id: 'card', type: 'Banner', props: {} }] };

      const result = await setup()
        .tool('ui_spec')
        .execute({ ...args, root: 'card' }, { toolCallId: 's1' });

      expect(result).toMatchObject({ ok: false, error: expect.stringContaining('Banner') });
    });

    it('rejects props that do not match the component schema', async () => {
      const args = {
        ...tripArgs,
        elements: [{ id: 'card', type: 'Card', props: { title: 42 }, children: [] }],
      };

      const result = await setup().tool('ui_spec').execute(args, { toolCallId: 's1' });

      expect(result).toMatchObject({ ok: false, error: expect.stringContaining('title') });
    });

    it('rejects arguments that are not a spec', async () => {
      const result = await setup().tool('ui_spec').execute({ elements: [] }, { toolCallId: 's1' });

      expect(result).toMatchObject({ ok: false });
    });

    it('rejects seeded state that a bound prop does not accept', async () => {
      const result = await setup()
        .tool('ui_spec')
        .execute({ ...tripArgs, state: { remind: 'yes please' } }, { toolCallId: 's1' });

      expect(result).toMatchObject({ ok: false, error: expect.stringContaining('"remind" (Toggle)') });
    });
  });

  describe('when the spec tool has instructions', () => {
    it('appends them to the description', () => {
      const { description } = setup({ instructions: 'Keep it short.' }).tool('ui_spec');

      expect(description.endsWith('Keep it short.')).toBe(true);
    });
  });

  describe('when the edit tool is given a mode it does not support', () => {
    it('refuses the definition and names the supported modes', () => {
      // `diff` is a json-render edit mode, but spec JSON repeats lines too often to place hunks reliably.
      expect(() => setup({ edit: { modes: ['patch', 'diff' as never] } })).toThrow(
        'Unknown GenUI spec edit mode "diff"; use patch or merge',
      );
    });
  });

  describe('when the edit tool runs on a thread with an earlier interface', () => {
    const thread = [message('a1', [specCall('s1', tripArgs)])];

    it('applies the edit to the latest interface and reports its base state', async () => {
      const result = await setup()
        .tool('ui_spec_edit')
        .execute(retitle('Lisbon'), { toolCallId: 'e1', messages: thread });

      expect(result).toEqual({ ok: true, id: 'e1', target: 's1', baseState: { remind: false } });
    });

    it('rejects an edit that breaks a component schema', async () => {
      const edit = {
        mode: 'patch',
        patch: [{ op: 'replace', path: '/elements/card/props/title', value: '42' }],
      };

      const result = await setup().tool('ui_spec_edit').execute(edit, { toolCallId: 'e1', messages: thread });

      expect(result).toMatchObject({ ok: false, error: expect.stringContaining('title') });
    });

    it('rejects an edit of an interface that does not exist', async () => {
      const result = await setup()
        .tool('ui_spec_edit')
        .execute(retitle('Lisbon', 'nope'), { toolCallId: 'e1', messages: thread });

      expect(result).toEqual({ ok: false, error: 'there is no interface "nope" to edit' });
    });

    it('rejects an edit of an interface that failed to display', async () => {
      const failed = [message('a1', [specCall('s1', tripArgs, { ok: false, error: 'bad' })])];

      const result = await setup()
        .tool('ui_spec_edit')
        .execute(retitle('Lisbon'), { toolCallId: 'e1', messages: failed });

      expect(result).toEqual({
        ok: false,
        error: 'interface "s1" could not be displayed, so it cannot be edited',
      });
    });

    it('needs the tool call id to know what it edits', async () => {
      const result = await setup().tool('ui_spec_edit').execute(retitle('Lisbon'), { messages: thread });

      expect(result).toEqual({ ok: false, error: 'ui_spec_edit was called without a tool call id' });
    });

    it('needs the conversation to know what it edits', async () => {
      const result = await setup().tool('ui_spec_edit').execute(retitle('Lisbon'), { toolCallId: 'e1' });

      expect(result).toEqual({ ok: false, error: 'ui_spec_edit was called without the conversation' });
    });

    it('edits the interface in the conversation each call brings', async () => {
      const edit = setup().tool('ui_spec_edit');
      const other = [message('b1', [specCall('s9', { ...tripArgs, state: { remind: true } })])];

      const first = await edit.execute(retitle('Lisbon'), { toolCallId: 'e1', messages: thread });
      const second = await edit.execute(retitle('Porto'), { toolCallId: 'e2', messages: other });

      expect(first).toMatchObject({ ok: true, target: 's1', baseState: { remind: false } });
      expect(second).toMatchObject({ ok: true, target: 's9', baseState: { remind: true } });
    });

    it('starts from the state the user set when it shares the resolver the views read', async () => {
      const definition = createGenUIDefinition({ catalog: tripCatalog, specTool: true });
      const resolver = createSpecResolver({
        ...(definition.specTool ? { specTool: definition.specTool } : {}),
        stateOf: toolCallId => (toolCallId === 's1' ? { remind: true } : undefined),
      });

      const result = await setup(true, resolver)
        .tool('ui_spec_edit')
        .execute(retitle('Lisbon'), { toolCallId: 'e1', messages: thread });

      expect(result).toEqual({ ok: true, id: 'e1', target: 's1', baseState: { remind: true } });
    });
  });

  describe('when the edit tool runs before any interface exists', () => {
    it('tells the model there is nothing to edit', async () => {
      const result = await setup().tool('ui_spec_edit').execute(retitle('Lisbon'), { toolCallId: 'e1', messages: [] });

      expect(result).toEqual({ ok: false, error: 'there is no interface to edit' });
    });
  });

  describe('when the edited interface is still streaming', () => {
    it('names the interface that is not complete yet', async () => {
      const streaming = message('a1', [
        {
          type: 'tool-invocation',
          toolInvocation: { state: 'partial-call', toolCallId: 's1', toolName: 'ui_spec', argsText: '{"ro' },
        },
      ]);

      const result = await setup()
        .tool('ui_spec_edit')
        .execute(retitle('Lisbon'), { toolCallId: 'e1', messages: [streaming] });

      expect(result).toEqual({ ok: false, error: 'interface "s1" is not complete yet' });
    });
  });
});
