import type { Meta, StoryObj } from '@storybook/react-vite';
import { useRef, useState } from 'react';

import { KeyboardScope, KeyboardShortcutsProvider } from './keyboard-shortcuts-context';
import { useKeydown, useTableKeydown } from './use-keydown';
import { Kbd } from '@/ds/components/Kbd';

const meta: Meta = {
  title: 'Hooks/useKeydown',
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj;

type LogEntry = { id: number; time: string; message: string };

const useLog = () => {
  const [entries, setEntries] = useState<LogEntry[]>([]);

  const log = (message: string) => {
    const time = new Date().toISOString().slice(11, 23);
    console.log(`[useKeydown] ${message}`);
    setEntries(prev => [{ id: Date.now() + Math.random(), time, message }, ...prev].slice(0, 30));
  };

  return { entries, log, clear: () => setEntries([]) };
};

const LogConsole = ({ entries, onClear }: { entries: LogEntry[]; onClear: () => void }) => (
  <div className="border-border1 bg-surface2 text-ui-sm rounded-lg border font-mono">
    <div className="border-border1 flex items-center justify-between border-b px-3 py-2">
      <span className="text-neutral3">console ({entries.length})</span>
      <button type="button" onClick={onClear} className="text-neutral3 hover:text-neutral5">
        clear
      </button>
    </div>
    <ul className="max-h-64 overflow-auto p-3">
      {entries.length === 0 && <li className="text-neutral3">Press a key…</li>}
      {entries.map(entry => (
        <li key={entry.id} className="flex gap-3">
          <span className="text-neutral3">{entry.time}</span>
          <span className="text-neutral5">{entry.message}</span>
        </li>
      ))}
    </ul>
  </div>
);

const Keys = ({ keys }: { keys: string }) => (
  <span className="inline-flex items-center gap-1">
    {keys.split(/(\+|\s+then\s+)/).map((part, i) =>
      part === '+' || /then/.test(part) ? (
        <span key={i} className="text-neutral3">
          {part.trim()}
        </span>
      ) : (
        <Kbd key={i} size="sm">
          {part}
        </Kbd>
      ),
    )}
  </span>
);

const Legend = ({ items }: { items: Array<[string, string]> }) => (
  <ul className="text-ui-sm text-neutral4 flex flex-col gap-2">
    {items.map(([keys, label]) => (
      <li key={keys} className="flex items-center gap-3">
        <Keys keys={keys} />
        <span>{label}</span>
      </li>
    ))}
  </ul>
);

const Layout = ({
  title,
  children,
  log,
}: {
  title: string;
  children: React.ReactNode;
  log: ReturnType<typeof useLog>;
}) => (
  <div className="flex max-w-3xl flex-col gap-4">
    <p className="text-ui-md text-neutral5">{title}</p>
    {children}
    <LogConsole entries={log.entries} onClear={log.clear} />
  </div>
);

const SimpleCombosDemo = () => {
  const out = useLog();
  useKeydown({
    'mod+k': () => out.log('mod+k → open command palette'),
    'ctrl+shift+p': () => out.log('ctrl+shift+p → run command'),
    Escape: () => out.log('Escape → close'),
    ArrowUp: () => out.log('ArrowUp'),
    ArrowDown: () => out.log('ArrowDown'),
    '/': () => out.log('/ → focus search'),
  });

  return (
    <Layout title="Single combos on window. Click anywhere in the canvas first." log={out}>
      <Legend
        items={[
          ['mod+k', 'command palette'],
          ['ctrl+shift+p', 'run command'],
          ['Escape', 'close'],
          ['ArrowUp+ArrowDown', 'navigate'],
          ['/', 'focus search'],
        ]}
      />
    </Layout>
  );
};

export const SimpleCombos: Story = { render: () => <SimpleCombosDemo /> };

const TimedSequencesDemo = () => {
  const out = useLog();
  useKeydown({
    'g$+a': () => out.log('g then a → go to Agents'),
    'g$+w': () => out.log('g then w → go to Workflows'),
    'g$+t': () => out.log('g then t → go to Tools'),
    '?': () => out.log('? → show shortcuts'),
  });

  return (
    <Layout title="GitHub-style timed sequences: press g, then the next key within 500ms." log={out}>
      <Legend
        items={[
          ['g then a', 'Agents'],
          ['g then w', 'Workflows'],
          ['g then t', 'Tools'],
          ['?', 'shortcuts'],
        ]}
      />
    </Layout>
  );
};

export const TimedSequences: Story = { render: () => <TimedSequencesDemo /> };

const ChainedSequenceDemo = () => {
  const out = useLog();
  useKeydown({
    'a$+b$+c': () => out.log('a → b → c completed (each within 500ms)'),
    'mod+k$+mod+s': () => out.log('mod+k then mod+s (chord with modifiers)'),
  });

  return (
    <Layout title="Longer chains and chords with modifiers on each step." log={out}>
      <Legend
        items={[
          ['a then b then c', 'three steps, 500ms between each'],
          ['mod+k then mod+s', 'two chords, 500ms window'],
        ]}
      />
    </Layout>
  );
};

export const ChainedSequences: Story = { render: () => <ChainedSequenceDemo /> };

const PrefixVsPlainDemo = () => {
  const out = useLog();
  useKeydown({
    g: () => out.log('plain g (never fires: the sequence prefix wins)'),
    'g$+a': () => out.log('g then a'),
    x: () => out.log('plain x'),
  });

  return (
    <Layout
      title="Precedence rules: a prefix beats a plain binding on the same key; an unexpected key resets the sequence and is evaluated normally."
      log={out}
    >
      <Legend
        items={[
          ['g', 'plain binding — shadowed by the prefix'],
          ['g then a', 'sequence'],
          ['g then x', 'resets, then fires plain x'],
        ]}
      />
    </Layout>
  );
};

export const PrefixPrecedence: Story = { render: () => <PrefixVsPlainDemo /> };

const ScopedTargetDemo = () => {
  const out = useLog();
  const ref = useRef<HTMLDivElement | null>(null);
  useKeydown(
    {
      'g$+a': () => out.log('g then a (inside the panel)'),
      Enter: () => out.log('Enter (inside the panel)'),
    },
    { target: ref },
  );

  return (
    <Layout title="Listener attached to a target element instead of window." log={out}>
      <div className="flex gap-4">
        <div
          ref={ref}
          tabIndex={0}
          className="border-border1 bg-surface3 text-ui-sm text-neutral4 focus:border-accent1 flex-1 rounded-lg border p-6 outline-none"
        >
          Focus me, then press <Keys keys="g then a" /> or <Keys keys="Enter" />.
        </div>
        <div
          tabIndex={0}
          className="border-border1 text-ui-sm text-neutral3 focus:border-accent1 flex-1 rounded-lg border border-dashed p-6 outline-none"
        >
          Keys pressed here are ignored.
        </div>
      </div>
    </Layout>
  );
};

export const ScopedTarget: Story = { render: () => <ScopedTargetDemo /> };

const TypingInFieldsDemo = () => {
  const out = useLog();

  useKeydown(
    {
      'g$+a': () => out.log('g then a'),
      '?': () => out.log('? → show shortcuts'),
      'mod+k': () => out.log('mod+k → still fires from inside the input'),
    },
    { shouldHandle: event => !event.repeat },
  );

  return (
    <Layout
      title="Unmodified keys are ignored while typing in a field (built-in). Modifier combos still fire. shouldHandle adds extra filtering (here: no key repeat)."
      log={out}
    >
      <input
        placeholder="Type g, a or ? here — they are typed, not intercepted. Try mod+k."
        className="border-border1 bg-surface3 text-ui-sm text-neutral5 focus:border-accent1 rounded-md border px-3 py-2 outline-none"
      />
    </Layout>
  );
};

export const TypingInFields: Story = { render: () => <TypingInFieldsDemo /> };

const EnabledToggleDemo = () => {
  const out = useLog();
  const [enabled, setEnabled] = useState(true);
  useKeydown({ 'g$+a': () => out.log('g then a'), 'mod+k': () => out.log('mod+k') }, { enabled });

  return (
    <Layout title="enabled: detaching the listener also cancels any armed sequence." log={out}>
      <label className="text-ui-sm text-neutral4 flex items-center gap-2">
        <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
        listener enabled
      </label>
    </Layout>
  );
};

export const EnabledToggle: Story = { render: () => <EnabledToggleDemo /> };

const LayoutShortcuts = ({ log }: { log: (message: string) => void }) => {
  useKeydown({
    'g$+a': () => log('layout: g then a → /agents'),
    'g$+t': () => log('layout: g then t → /traces'),
  });
  return null;
};

const AgentPageShortcuts = ({ log }: { log: (message: string) => void }) => {
  useKeydown({ 'g$+t': () => log('agent page: g then t → /agents/:id/traces') });
  return null;
};

const ScopedOverrideDemo = () => {
  const out = useLog();
  const [agentPageMounted, setAgentPageMounted] = useState(false);

  return (
    <KeyboardShortcutsProvider>
      <LayoutShortcuts log={out.log} />
      <Layout
        title="Shortcuts declared inside a KeyboardScope shadow the layout's while mounted. Only one window listener runs."
        log={out}
      >
        <Legend
          items={[
            ['g then a', 'layout only'],
            ['g then t', 'layout, or agent page when mounted'],
          ]}
        />
        <label className="text-ui-sm text-neutral4 flex items-center gap-2">
          <input type="checkbox" checked={agentPageMounted} onChange={e => setAgentPageMounted(e.target.checked)} />
          mount the agent page
        </label>
        {agentPageMounted && (
          <KeyboardScope>
            <div className="border-accent1 text-ui-sm text-neutral4 rounded-lg border border-dashed p-3">
              agent page mounted — <Keys keys="g then t" /> now targets the agent's traces
            </div>
            <AgentPageShortcuts log={out.log} />
          </KeyboardScope>
        )}
      </Layout>
    </KeyboardShortcutsProvider>
  );
};

export const ScopedOverride: Story = { render: () => <ScopedOverrideDemo /> };

const LevelShortcuts = ({ level, log }: { level: string; log: (message: string) => void }) => {
  useKeydown({ k: () => log(`k handled by ${level}`), 'g$+a': () => log(`g then a handled by ${level}`) });
  return null;
};

const Level = ({ index, maxDepth, log }: { index: number; maxDepth: number; log: (message: string) => void }) => {
  if (index > maxDepth) return null;
  return (
    <KeyboardScope>
      <div className="border-border1 text-ui-sm text-neutral4 rounded-lg border p-3">
        scope depth {index}
        <LevelShortcuts level={`depth ${index}`} log={log} />
        <div className="mt-3">
          <Level index={index + 1} maxDepth={maxDepth} log={log} />
        </div>
      </div>
    </KeyboardScope>
  );
};

const NestedScopesDemo = () => {
  const out = useLog();
  const [levels, setLevels] = useState(3);

  return (
    <KeyboardShortcutsProvider>
      <LevelShortcuts level="root (depth 0)" log={out.log} />
      <Layout title="Every level binds k and g then a; the deepest mounted scope wins." log={out}>
        <label className="text-ui-sm text-neutral4 flex items-center gap-2">
          mounted depth
          <input type="range" min={0} max={3} value={levels} onChange={e => setLevels(Number(e.target.value))} />
          {levels}
        </label>
        <Level index={1} maxDepth={levels} log={out.log} />
      </Layout>
    </KeyboardShortcutsProvider>
  );
};

export const NestedScopes: Story = { render: () => <NestedScopesDemo /> };

const rows = Array.from({ length: 25 }, (_, i) => `Row ${i + 1}`);

const TableNavigationDemo = () => {
  const out = useLog();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { activeIndex, getRowProps, activate } = useTableKeydown({
    count: rows.length,
    containerRef,
    pageSize: 5,
    global: true,
    onNavigate: index => out.log(`navigate → ${index}`),
    onActivate: index => out.log(`activate → ${rows[index]}`),
  });

  return (
    <Layout
      title="useTableKeydown: ArrowUp/Down, PageUp/Down (5), Home/End, mod+Home/End. Works before any row has focus (global)."
      log={out}
    >
      <div ref={containerRef} className="border-border1 max-h-48 overflow-auto rounded-lg border">
        {rows.map((row, index) => (
          <div
            key={row}
            {...getRowProps(index)}
            onClick={() => activate(index)}
            onKeyDown={event => {
              getRowProps(index).onKeyDown(event);
              if (event.key === 'Enter') activate(index);
            }}
            className={`text-ui-sm cursor-pointer px-3 py-1.5 outline-none ${
              index === activeIndex ? 'bg-surface4 text-neutral5' : 'text-neutral4 hover:bg-surface3'
            }`}
          >
            {row}
          </div>
        ))}
      </div>
    </Layout>
  );
};

export const TableNavigation: Story = { render: () => <TableNavigationDemo /> };
