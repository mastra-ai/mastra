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

const GRADIENT_PNG =
  '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';

const largeSource = Array.from(
  { length: 3_000 },
  (_, i) =>
    `export async function digest${i}(rows: Row[]) {\n  return rows.filter(row => row.channel === "#c-${i % 12}").length; // ${i}\n}`,
).join('\n');

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
  ['assets/gradient.png', { content: GRADIENT_PNG, mimeType: 'image/png' }],
  [
    'README.md',
    {
      content:
        '# Mastra news\n\nDaily digests land in `cache/slack`.\n\n![Remote badge](https://img.shields.io/badge/status-live-green)\n\n![Relative image](./assets/gradient.png)\n\n![Broken link](./100%zz.png)\n\n```ts\nconst digest = await agent.generate(prompt);\n```\n',
    },
  ],
  ['src/digest.ts', { content: largeSource }],
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

export const ImageFile: Story = { args: { initialFile: 'assets/gradient.png' } };

export const MarkdownFile: Story = { args: { initialFile: 'README.md' } };

export const LargeSourceFile: Story = { args: { initialFile: 'src/digest.ts' } };

export const BinaryAudio: Story = { args: { initialFile: 'sfx/applause.wav' } };

export const ReadError: Story = { args: { initialFile: 'missing.json' } };

export const HostileStrings: Story = { args: { initialFile: 'edge/hostile-strings.json' } };

export const LargeFolder: Story = { args: { initialFile: 'logs/run-04999.json' } };
