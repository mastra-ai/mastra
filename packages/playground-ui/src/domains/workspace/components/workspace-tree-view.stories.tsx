import { MastraReactProvider } from '@mastra/react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { WorkspaceTreeView } from './workspace-tree-view';
import { TooltipProvider } from '@/ds/components/Tooltip';

const BASE_URL = 'http://localhost:4111';
const WORKSPACE_ID = 'story-workspace';

const day = (index: number) => `2026-11-${String(index + 1).padStart(2, '0')}`;

const digest = (bytes: number) => {
  const rowCount = Math.max(1, Math.round(bytes / 236));
  return JSON.stringify({
    rows: Array.from({ length: rowCount }, (_, i) => ({
      id: `row-${i}`,
      channel: `#channel-${i % 12}`,
      author: `person-${i % 37}`,
      ts: `${1763600000 + i * 17}.${String(i).padStart(6, '0')}`,
      text: `Message ${i}: shipped the change, see https://example.com/runs/${i} for details & "quotes" <tags>`,
      reactions: i % 3 === 0 ? [{ name: 'eyes', count: i % 5 }] : [],
      thread: i % 4 === 0 ? { replies: i % 9, latest: null } : null,
    })),
    summary: { total: rowCount, channels: 12, generatedAt: '2026-11-23T08:00:00.000Z' },
    coverage: { from: '2026-11-22T00:00:00.000Z', to: '2026-11-23T00:00:00.000Z', complete: true },
    headsup: ['Release freeze starts Friday', 'Rotate the staging keys'],
  });
};

const digestSizes = new Map([
  ['2026-11-19', 1_317],
  ['2026-11-20', 21_905],
  ['2026-11-21', 40_216],
  ['2026-11-22', 374_886],
  ['2026-11-23', 157_723],
  ['2026-11-24', 557_946],
]);

const prettyConfig = JSON.stringify(
  { name: 'mastra-news', schedule: '0 8 * * *', sources: ['slack', 'github'], retries: 3, notify: true },
  null,
  2,
);

const hostileStrings = JSON.stringify({
  emoji: 'Ωmega 🚀 Łódź',
  rtl: 'مرحبا بالعالم',
  html: '<b>bold</b><script>alert(1)</script>',
  sql: "'; DROP TABLE x;--",
  template: '{{name}}',
  big: 0,
  word: 'x'.repeat(2_000),
}).replace('"big":0', '"big":12345678901234567890');

const wavHeader =
  'RIFF\u0024\u00e2\u0004\u0000WAVEfmt \u0010\u0000\u0000\u0000\u0001\u0000\u0002\u0000D\u00ac\u0000\u0000';
const wavText = wavHeader + Array.from({ length: 200_000 }, (_, i) => String.fromCharCode((i * 7919) % 256)).join('');

interface StoryFile {
  content: string;
  mimeType?: string;
}

const files = new Map<string, StoryFile>([
  ['config.json', { content: prettyConfig, mimeType: 'application/json' }],
  ['empty.json', { content: '', mimeType: 'application/json' }],
  ['broken.json', { content: '{"rows": [1, 2, 3], "summary": {"total": 3,', mimeType: 'application/json' }],
  ['notes.txt', { content: 'Plain text notes.\nSecond line.', mimeType: 'text/plain' }],
  ['edge/hostile-strings.json', { content: hostileStrings }],
  ['edge/four-space.json', { content: JSON.stringify({ indent: 4, nested: { list: [1, 2, 3] } }, null, 4) }],
  ['edge/already-formatted.json', { content: prettyConfig }],
  ['edge/deeply-nested.json', { content: `${'['.repeat(5000)}1${']'.repeat(5000)}` }],
  ['edge/whitespace-only.json', { content: '\n\n   \n' }],
  ['edge/scalar.json', { content: '"just a string"' }],
  ['edge/byte-order-mark.json', { content: '\uFEFF{"a":1}' }],
  [
    'edge/Maximilian-Alexander-Wolfeschlegelsteinhausenbergerdorff-quarterly-export-final.json',
    { content: '{"ok":true}' },
  ],
  ['sfx/applause.wav', { content: wavText, mimeType: 'audio/wav' }],
  ...Array.from({ length: 24 }, (_, i): [string, StoryFile] => [
    `cache/slack/${day(i)}.json`,
    { content: digest(digestSizes.get(day(i)) ?? 700 + i * 40), mimeType: 'text/plain;charset=UTF-8' },
  ]),
]);

const UNREADABLE_FILE = 'missing.json';

const LOG_COUNT = 5_000;
for (let i = 0; i < LOG_COUNT; i++) {
  files.set(`logs/run-${String(i).padStart(5, '0')}.json`, { content: `{"run":${i}}`, mimeType: 'application/json' });
}

function listDirectory(dir: string) {
  const prefix = dir === '.' ? '' : `${dir}/`;
  const entries = new Map<string, 'file' | 'directory'>();
  for (const path of [...files.keys(), UNREADABLE_FILE]) {
    if (!path.startsWith(prefix)) continue;
    const [name = '', ...rest] = path.slice(prefix.length).split('/');
    entries.set(name, rest.length > 0 ? 'directory' : 'file');
  }
  return [...entries].map(([name, type]) => ({ name, type }));
}

const storyFetch: typeof fetch = async input => {
  const url = new URL(new Request(input).url);
  const path = url.searchParams.get('path') ?? '.';
  if (url.pathname.endsWith('/fs/list')) return Response.json({ path, entries: listDirectory(path) });
  if (url.pathname.endsWith('/fs/read')) {
    await new Promise(resolve => setTimeout(resolve, 150));
    const file = files.get(path);
    return file
      ? Response.json({ path, type: 'file', ...file })
      : Response.json({ error: `${path} could not be read` }, { status: 500 });
  }
  return Response.json({ error: 'Unsupported' }, { status: 501 });
};

function Explorer({ initialFile }: { initialFile?: string }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  const [activeFilePath, setActiveFilePath] = useState(initialFile);
  return (
    <MastraReactProvider baseUrl={BASE_URL} customFetch={storyFetch}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <div className="h-screen">
            <WorkspaceTreeView
              workspaceId={WORKSPACE_ID}
              activeFilePath={activeFilePath}
              onActiveFileChange={setActiveFilePath}
              searchFiles={false}
              searchSkills={false}
              onCreateDirectory={() => {}}
            />
          </div>
        </TooltipProvider>
      </QueryClientProvider>
    </MastraReactProvider>
  );
}

const meta: Meta<typeof Explorer> = {
  title: 'Domains/Workspace/TreeView',
  component: Explorer,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof Explorer>;

export const SmallJson: Story = { args: { initialFile: 'config.json' } };

export const LargeSingleLineJson: Story = { args: { initialFile: 'cache/slack/2026-11-23.json' } };

export const MalformedJson: Story = { args: { initialFile: 'broken.json' } };

export const EmptyFile: Story = { args: { initialFile: 'empty.json' } };

export const BinaryAudio: Story = { args: { initialFile: 'sfx/applause.wav' } };

export const ReadError: Story = { args: { initialFile: 'missing.json' } };

export const HostileStrings: Story = { args: { initialFile: 'edge/hostile-strings.json' } };

export const LargeFolder: Story = { args: { initialFile: 'logs/run-04999.json' } };
