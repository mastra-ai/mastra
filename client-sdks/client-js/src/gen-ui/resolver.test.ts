import { SPEC_DATA_PART_TYPE } from '@json-render/core';
import type { StateModel } from '@json-render/core';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { describe, expect, it } from 'vitest';
import { createSpecResolver } from './index';
import type { GenUISpecToolConfig, NormalizedToolCall } from './index';

const specTool: GenUISpecToolConfig = {
  name: 'ui_spec',
  edit: { name: 'ui_spec_edit', modes: ['patch', 'merge'] },
};

const message = (id: string, role: 'user' | 'assistant', parts: object[]): MastraDBMessage => ({
  id,
  role,
  createdAt: new Date(0),
  threadId: 'thread-1',
  resourceId: 'resource-1',
  content: { format: 2, parts: parts as MastraDBMessage['content']['parts'] },
});

/** A tool call as a thread stores it once the run is over. */
const invocation = (toolCallId: string, toolName: string, args: object, result?: object) => ({
  type: 'tool-invocation',
  toolInvocation:
    result === undefined
      ? { state: 'call', toolCallId, toolName, args }
      : { state: 'result', toolCallId, toolName, args, result },
});

const tripSpec = {
  root: 'card',
  state: { remind: false },
  elements: [
    { id: 'card', type: 'Card', props: { title: 'Trip' }, children: ['remind'] },
    { id: 'remind', type: 'Toggle', props: { label: 'Remind me', checked: { $bindState: '/remind' } } },
  ],
};

const retitle = (title: string, target?: string) => ({
  ...(target ? { target } : {}),
  mode: 'patch',
  patch: [{ op: 'replace', path: '/elements/card/props/title', value: JSON.stringify(title) }],
});

const titleOf = (read: { spec?: { elements: Record<string, { props: Record<string, unknown> }> } } | undefined) =>
  read?.spec?.elements.card?.props.title;

describe('createSpecResolver', () => {
  describe('when a thread carries a spec tool call', () => {
    it('builds the spec from its arguments, by tool call id', () => {
      const resolver = createSpecResolver({ specTool });
      resolver.update([
        message('u1', 'user', [{ type: 'text', text: 'plan my trip' }]),
        message('a1', 'assistant', [invocation('s1', 'ui_spec', tripSpec, { ok: true, id: 's1' })]),
      ]);

      expect(resolver.specForCall('s1')).toEqual({
        spec: {
          root: 'card',
          state: { remind: false },
          elements: {
            card: { type: 'Card', props: { title: 'Trip' }, children: ['remind'] },
            remind: { type: 'Toggle', props: { label: 'Remind me', checked: { $bindState: '/remind' } } },
          },
        },
      });
    });

    it('knows nothing of calls to other tools', () => {
      const resolver = createSpecResolver({ specTool });
      resolver.update([message('a1', 'assistant', [invocation('w1', 'getWeather', { city: 'Rome' }, { temp: 30 })])]);

      expect(resolver.specForCall('w1')).toBeUndefined();
    });

    it('reports a spec whose elements loop back on themselves', () => {
      const resolver = createSpecResolver({ specTool });
      resolver.update([
        message('a1', 'assistant', [
          invocation('s1', 'ui_spec', {
            root: 'a',
            elements: [
              { id: 'a', type: 'Card', props: {}, children: ['b'] },
              { id: 'b', type: 'Card', props: {}, children: ['a'] },
            ],
          }),
        ]),
      ]);

      expect(resolver.specForCall('s1')).toEqual({ error: 'element "a" contains itself' });
    });
  });

  describe('when the spec call is still streaming', () => {
    it('resolves the elements written so far and waits on the one cut mid-value', () => {
      const resolver = createSpecResolver({ specTool });
      const call: NormalizedToolCall = {
        toolCallId: 's1',
        toolName: 'ui_spec',
        phase: 'input-streaming',
        argsText:
          '{"root":"card","elements":[{"id":"card","type":"Card","props":{"title":"Trip"}},{"id":"remind","type":"Tog',
        args: undefined,
        output: undefined,
      };

      expect(resolver.readCall(call).spec?.elements).toEqual({ card: { type: 'Card', props: { title: 'Trip' } } });
    });
  });

  describe('when an edit call names the interface it changes', () => {
    it('applies the edit to that interface and leaves the original as it was', () => {
      const resolver = createSpecResolver({ specTool });
      resolver.update([
        message('a1', 'assistant', [
          invocation('s1', 'ui_spec', tripSpec, { ok: true, id: 's1' }),
          invocation('e1', 'ui_spec_edit', retitle('Oslo', 's1'), { ok: true, id: 'e1' }),
        ]),
      ]);

      expect(titleOf(resolver.specForCall('e1'))).toBe('Oslo');
      expect(titleOf(resolver.specForCall('s1'))).toBe('Trip');
    });

    it('starts from the state the user set in the target, captured once', () => {
      const states = new Map<string, StateModel>([['s1', { remind: true }]]);
      const resolver = createSpecResolver({ specTool, stateOf: id => states.get(id) });
      resolver.update([
        message('a1', 'assistant', [
          invocation('s1', 'ui_spec', tripSpec, { ok: true, id: 's1' }),
          invocation('e1', 'ui_spec_edit', retitle('Oslo', 's1')),
        ]),
      ]);

      expect(resolver.specForCall('e1')?.spec?.state).toEqual({ remind: true });
      // The user keeps toggling the original after the edit was made: the edit does not follow.
      states.set('s1', { remind: false });
      expect(resolver.specForCall('e1')?.spec?.state).toEqual({ remind: true });
    });

    it('rebuilds from the state stored in its result, as after a reload', () => {
      const resolver = createSpecResolver({ specTool, stateOf: () => ({ remind: false }) });
      resolver.update([
        message('a1', 'assistant', [
          invocation('s1', 'ui_spec', tripSpec, { ok: true, id: 's1' }),
          invocation('e1', 'ui_spec_edit', retitle('Oslo', 's1'), {
            ok: true,
            id: 'e1',
            baseState: { remind: true },
          }),
        ]),
      ]);

      expect(resolver.specForCall('e1')?.spec?.state).toEqual({ remind: true });
    });

    it('refuses to edit an interface that could not be displayed', () => {
      const resolver = createSpecResolver({ specTool });
      resolver.update([
        message('a1', 'assistant', [
          invocation('s1', 'ui_spec', tripSpec, { ok: false, error: 'root is missing' }),
          invocation('e1', 'ui_spec_edit', retitle('Oslo', 's1')),
        ]),
      ]);

      expect(resolver.specForCall('e1')).toEqual({
        error: 'interface "s1" could not be displayed, so it cannot be edited',
      });
    });

    it('refuses an edit of an interface the thread does not have', () => {
      const resolver = createSpecResolver({ specTool });
      resolver.update([message('a1', 'assistant', [invocation('e1', 'ui_spec_edit', retitle('Oslo', 'nope'))])]);

      expect(resolver.specForCall('e1')).toEqual({ error: 'there is no interface "nope" to edit' });
    });
  });

  describe('when an edit call names no target', () => {
    it('edits the latest interface before it, including an earlier edit', () => {
      const resolver = createSpecResolver({ specTool });
      resolver.update([
        message('a1', 'assistant', [
          invocation('s1', 'ui_spec', tripSpec, { ok: true, id: 's1' }),
          invocation('e1', 'ui_spec_edit', retitle('Oslo'), { ok: true, id: 'e1' }),
        ]),
        message('a2', 'assistant', [
          invocation('e2', 'ui_spec_edit', {
            mode: 'patch',
            patch: [{ op: 'replace', path: '/elements/remind/props/label', value: '"Ping me"' }],
          }),
        ]),
      ]);

      const read = resolver.specForCall('e2');
      expect(titleOf(read)).toBe('Oslo');
      expect(read?.spec?.elements.remind?.props.label).toBe('Ping me');
      expect(resolver.readEditBase('e2', { mode: 'patch' }).target).toBe('e1');
    });
  });

  describe('when the resolver is reset', () => {
    it('captures the target state again on the next read', () => {
      const states = new Map<string, StateModel>([['s1', { remind: true }]]);
      const resolver = createSpecResolver({ specTool, stateOf: id => states.get(id) });
      resolver.update([
        message('a1', 'assistant', [
          invocation('s1', 'ui_spec', tripSpec, { ok: true, id: 's1' }),
          invocation('e1', 'ui_spec_edit', retitle('Oslo', 's1')),
        ]),
      ]);
      expect(resolver.specForCall('e1')?.spec?.state).toEqual({ remind: true });

      states.set('s1', { remind: false });
      resolver.reset();
      expect(resolver.specForCall('e1')?.spec?.state).toEqual({ remind: false });
    });
  });

  describe('when an assistant message carries json-render data-spec parts', () => {
    const patches = [
      { op: 'add', path: '/root', value: 'card' },
      { op: 'add', path: '/elements/card', value: { type: 'Card', props: { title: 'Trip' }, children: [] } },
      { op: 'add', path: '/elements/go', value: { type: 'Button', props: { label: 'Book it' } } },
      { op: 'add', path: '/elements/card/children/-', value: 'go' },
    ];
    const dataParts = () => patches.map(patch => ({ type: SPEC_DATA_PART_TYPE, data: { type: 'patch', patch } }));

    it('folds them into one spec for the message, needing no spec tool', () => {
      const resolver = createSpecResolver();
      const parts = dataParts();
      resolver.update([message('a1', 'assistant', [{ type: 'text', text: 'Here is your trip.' }, ...parts])]);

      expect(resolver.readDataSpec('a1')).toEqual({
        live: true,
        spec: {
          root: 'card',
          elements: {
            card: { type: 'Card', props: { title: 'Trip' }, children: ['go'] },
            go: { type: 'Button', props: { label: 'Book it' } },
          },
        },
      });
      expect(resolver.dataSpecOf(parts[0]!)).toBe('a1');
      expect(resolver.dataSpecOf(parts[1]!)).toBeUndefined();
    });

    it('folds the parts again as more arrive without applying earlier ones twice', () => {
      const resolver = createSpecResolver();
      const parts = dataParts();
      resolver.update([message('a1', 'assistant', parts.slice(0, 3))]);
      expect(resolver.readDataSpec('a1').spec?.elements.card?.children).toEqual([]);

      resolver.update([message('a1', 'assistant', parts)]);
      expect(resolver.readDataSpec('a1').spec?.elements.card?.children).toEqual(['go']);
      // Stored parts stay as they arrived, so a reload folds them the same way.
      expect(parts[1]!.data.patch.value).toEqual({ type: 'Card', props: { title: 'Trip' }, children: [] });
    });

    it('takes a whole flat or nested spec part as well as patches', () => {
      const resolver = createSpecResolver();
      resolver.update([
        message('a1', 'assistant', [
          {
            type: SPEC_DATA_PART_TYPE,
            data: { type: 'flat', spec: { root: 'card', elements: { card: { type: 'Card', props: {} } } } },
          },
        ]),
        message('a2', 'assistant', [
          {
            type: SPEC_DATA_PART_TYPE,
            data: {
              type: 'nested',
              spec: { type: 'Card', props: {}, children: [{ type: 'Button', props: { label: 'Go' } }] },
            },
          },
        ]),
      ]);

      expect(resolver.readDataSpec('a1').spec?.root).toBe('card');
      const nested = resolver.readDataSpec('a2').spec;
      expect(nested?.elements[nested.root]?.type).toBe('Card');
      const [child] = nested?.elements[nested.root]?.children ?? [];
      expect(nested?.elements[child!]).toMatchObject({ type: 'Button', props: { label: 'Go' } });
    });

    it('marks only the latest assistant message as still growing', () => {
      const resolver = createSpecResolver();
      resolver.update([message('a1', 'assistant', dataParts())]);
      expect(resolver.readDataSpec('a1').live).toBe(true);

      resolver.update([
        message('a1', 'assistant', dataParts()),
        message('a2', 'assistant', [{ type: 'text', text: 'ok' }]),
      ]);
      expect(resolver.readDataSpec('a1').live).toBe(false);
    });
  });

  describe('when the thread is updated', () => {
    it('says whether any spec changed', () => {
      const resolver = createSpecResolver({ specTool });
      const pending = [message('a1', 'assistant', [invocation('s1', 'ui_spec', tripSpec)])];
      const answered = [message('a1', 'assistant', [invocation('s1', 'ui_spec', tripSpec, { ok: true, id: 's1' })])];

      expect(resolver.update(pending)).toBe(true);
      expect(resolver.update(pending)).toBe(false);
      expect(resolver.update(answered)).toBe(true);
      expect(resolver.update([...answered, message('u2', 'user', [{ type: 'text', text: 'thanks' }])])).toBe(false);
    });
  });
});
