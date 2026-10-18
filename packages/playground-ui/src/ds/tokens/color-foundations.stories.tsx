import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import colorsCss from '../../../theme/colors.css?raw';
import dataVizCss from '../../../theme/data-viz.css?raw';
import statusCss from '../../../theme/status.css?raw';
import surfacesCss from '../../../theme/surfaces.css?raw';
import themeCss from '../../../theme.css?raw';
import { Popover, PopoverContent, PopoverTrigger } from '../components/Popover';
import { Txt } from '../components/Txt/Txt';
import { FoundationPage, FoundationSection } from './foundations-layout';
import { cn } from '@/lib/utils';

const meta = {
  title: 'Foundations/Color',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Ramps are the raw material; components use roles. Select any swatch to see its value and what resolves to it.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

type Theme = 'dark' | 'light';

const themeSources = [themeCss, colorsCss, statusCss, dataVizCss, surfacesCss];
const rampPattern =
  /^(?:(?:red|orange|amber|green|cyan|blue|purple|pink)-(?:soft-)?\d+|gray-(?:alpha-)?\d+|background-\d)$/;

const readTheme = (theme: Theme) => {
  const references = new Map<string, string>();
  const values = new Map<string, string>();
  const selectors = theme === 'light' ? [':root', '@theme static', 'html.light'] : [':root', '@theme static'];
  for (const selector of selectors) {
    for (const source of themeSources) {
      for (const [, blockSelector, body = ''] of source.matchAll(
        /(?:^|\n)(:root|html\.light|@theme static)\s*\{([^}]*)\}/g,
      )) {
        if (blockSelector !== selector) continue;
        for (const [, name = '', value = ''] of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
          const reference = value.match(/^var\(--([\w-]+)\)$/)?.[1];
          if (reference) {
            references.set(name, reference);
            values.delete(name);
          } else {
            values.set(name, value.trim());
            references.delete(name);
          }
        }
      }
    }
  }

  const resolve = (token: string) => {
    const chain: string[] = [];
    let next = references.get(token);
    while (next && !chain.includes(next)) {
      chain.push(next);
      next = references.get(next);
    }
    return { chain, value: values.get(chain.at(-1) ?? token) };
  };

  const usage = new Map<string, string[][]>();
  for (const role of [...references.keys()].sort()) {
    if (rampPattern.test(role)) continue;
    const { chain } = resolve(role);
    const step = chain.at(-1);
    if (step && rampPattern.test(step)) usage.set(step, [...(usage.get(step) ?? []), [role, ...chain]]);
  }

  return { resolve, usage };
};

const themes = { dark: readTheme('dark'), light: readTheme('light') };
const themeOf = (theme?: string): Theme => (theme === 'light' ? 'light' : 'dark');

const Mono = ({ children, tone = 'muted' }: { children: ReactNode; tone?: 'ink' | 'muted' | 'faint' }) => (
  <Txt variant="meta" font="mono" tone={tone} className="truncate">
    {children}
  </Txt>
);

const ColorDetails = ({ token, theme }: { token: string; theme: Theme }) => {
  const { resolve, usage } = themes[theme];
  const { chain, value } = resolve(token);
  const users = usage.get(token) ?? [];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="size-5 shrink-0 border border-border" style={{ background: `var(--${token})` }} />
        <Mono tone="ink">--{token}</Mono>
        <span className="ml-auto">
          <Mono tone="faint">{theme}</Mono>
        </span>
      </div>
      {chain.length > 0 && (
        <div className="flex flex-col gap-0.5">
          <Mono tone="faint">Resolves to</Mono>
          <Mono tone="ink">{chain.map(step => `--${step}`).join(' → ')}</Mono>
        </div>
      )}
      {value && (
        <div className="flex flex-col gap-0.5">
          <Mono tone="faint">Value</Mono>
          <Mono tone="ink">{value}</Mono>
        </div>
      )}
      {rampPattern.test(token) && (
        <div className="flex flex-col gap-1">
          <Mono tone="faint">{users.length === 0 ? 'No role uses this step' : `Used by ${users.length}`}</Mono>
          <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
            {users.map(([role, ...via]) => (
              <li key={role} className="flex min-w-0 items-baseline gap-2">
                <Mono tone="ink">--{role}</Mono>
                {via.length > 1 && (
                  <Mono tone="faint">
                    via{' '}
                    {via
                      .slice(0, -1)
                      .map(step => `--${step}`)
                      .join(', ')}
                  </Mono>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const ColorSwatch = ({ token, theme, className }: { token: string; theme: Theme; className?: string }) => (
  <Popover>
    <PopoverTrigger
      render={
        <button
          type="button"
          title={`--${token}`}
          className={cn(
            'block w-full cursor-pointer border border-border outline-offset-1 hover:outline-1 hover:outline-border-hover focus-visible:outline-2 focus-visible:outline-foreground data-[popup-open]:outline-2 data-[popup-open]:outline-foreground',
            className,
          )}
          style={{ background: `var(--${token})` }}
        />
      }
    />
    <PopoverContent align="start" className="w-80">
      <ColorDetails token={token} theme={theme} />
    </PopoverContent>
  </Popover>
);

type RampRow = { label: string; tokens: (string | null)[]; groupStart?: boolean; secondary?: boolean };

const RampGrid = ({ columns, rows, theme }: { columns: (string | number)[]; rows: RampRow[]; theme: Theme }) => (
  <div className="overflow-x-auto">
    <table className="w-full min-w-2xl table-fixed border-separate border-spacing-x-0.5 border-spacing-y-0">
      <thead>
        <tr>
          <th className="w-24" />
          {columns.map(column => (
            <th key={column} scope="col" className="pb-1.5 text-left font-normal">
              <Mono tone="faint">{column}</Mono>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr key={row.tokens.find(Boolean) ?? row.label}>
            <th scope="row" className={cn('pr-3 text-left align-top font-normal', row.groupStart && 'pt-3')}>
              <span className="flex h-7 items-center">
                <Mono tone={row.secondary ? 'faint' : 'ink'}>{row.label}</Mono>
              </span>
            </th>
            {row.tokens.map((token, index) => {
              const count = token ? (themes[theme].usage.get(token)?.length ?? 0) : 0;
              return (
                <td key={columns[index]} className={cn('align-top', row.groupStart && 'pt-3')}>
                  {token && (
                    <>
                      <ColorSwatch token={token} theme={theme} className="h-7" />
                      <span className="flex h-4 items-center">{count > 0 && <Mono tone="ink">{count}</Mono>}</span>
                    </>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

type TokenRow = { token: string; use: ReactNode };

const TokenTable = ({ rows, theme }: { rows: TokenRow[]; theme: Theme }) => (
  <div className="overflow-x-auto">
    <table className="w-full min-w-xl table-fixed border-collapse text-left">
      <thead>
        <tr className="border-b border-border">
          <th className="w-12 pb-1.5" />
          <th scope="col" className="w-56 pb-1.5 font-normal">
            <Mono tone="faint">Token</Mono>
          </th>
          <th scope="col" className="w-56 pb-1.5 font-normal">
            <Mono tone="faint">Resolves to in {theme}</Mono>
          </th>
          <th scope="col" className="pb-1.5 font-normal">
            <Mono tone="faint">Use</Mono>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ token, use }) => {
          const { chain, value } = themes[theme].resolve(token);
          return (
            <tr key={token} className="border-b border-border">
              <td className="py-1.5 pr-3">
                <ColorSwatch token={token} theme={theme} className="h-6" />
              </td>
              <td className="py-1.5 pr-3">
                <Mono tone="ink">--{token}</Mono>
              </td>
              <td className="py-1.5 pr-3">
                <Mono>{chain.length > 0 ? `--${chain.at(-1)}` : value}</Mono>
              </td>
              <td className="py-1.5">
                <Txt variant="caption" tone="muted" className="truncate">
                  {use}
                </Txt>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

const MatrixTable = ({
  rows,
  columns,
  token,
  theme,
}: {
  rows: string[];
  columns: string[];
  token: (row: string, column: string) => string;
  theme: Theme;
}) => (
  <div className="overflow-x-auto">
    <table className="w-full min-w-xl table-fixed border-separate border-spacing-0.5 text-left">
      <thead>
        <tr>
          <th className="w-32" />
          {columns.map(column => (
            <th key={column} scope="col" className="pb-1 font-normal">
              <Mono tone="faint">{column}</Mono>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr key={row}>
            <th scope="row" className="pr-3 font-normal">
              <Mono tone="ink">{row}</Mono>
            </th>
            {columns.map(column => (
              <td key={column}>
                <ColorSwatch token={token(row, column)} theme={theme} className="h-7" />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const hues = ['red', 'orange', 'amber', 'green', 'cyan', 'blue', 'purple', 'pink'];
const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const grayColumns = Array.from({ length: 10 }, (_, index) => index + 1);
const countNote = 'The number under a step counts the roles that resolve to it in this mode. Blank means unused.';

const chromaticRows: RampRow[] = hues.flatMap(hue => [
  { label: hue, tokens: steps.map(step => `${hue}-${step}`), groupStart: true },
  { label: 'soft', tokens: steps.map(step => `${hue}-soft-${step}`), secondary: true },
]);

const monochromeRows: RampRow[] = [
  { label: 'background', tokens: grayColumns.map(step => (step <= 3 ? `background-${step}` : null)) },
  { label: 'gray', tokens: grayColumns.map(step => `gray-${step}`), groupStart: true },
  { label: 'gray-alpha', tokens: grayColumns.map(step => `gray-alpha-${step}`), groupStart: true },
];

const rampGuidance: { ramp: string; use: string }[] = [
  {
    ramp: 'strong',
    use: 'Hue as information: indicators, edges, chart series, fills, and text on a tinted surface. Default for any new role.',
  },
  {
    ramp: 'soft',
    use: 'Hue under or beside text: dark-mode status and badge surfaces, and badge dots. Lower chroma so the text carries the meaning, not the fill.',
  },
];

const surfaceRows: TokenRow[] = [
  { token: 'background', use: 'Page canvas' },
  { token: 'sidebar', use: 'App chrome, one step behind the canvas' },
  { token: 'card', use: 'Raised container' },
  { token: 'popover', use: 'Menu, dropdown, tooltip' },
  { token: 'dialog', use: 'Dialog, drawer, alert dialog' },
  { token: 'field', use: 'Text field fill' },
  { token: 'field-disabled', use: 'Disabled field fill' },
  { token: 'muted', use: 'Quiet region inside a container' },
];

const textRows: TokenRow[] = [
  { token: 'foreground', use: <span className="text-foreground">Values, names, prose</span> },
  { token: 'muted-foreground', use: <span className="text-muted-foreground">Labels, timestamps, descriptions</span> },
  { token: 'placeholder', use: <span className="text-placeholder">Text not written yet</span> },
];

const productRoles = ['studio', 'server', 'observability', 'factory', 'workers', 'persistent-server'];

const chartRows: TokenRow[] = [
  { token: 'chart-blue', use: 'Primary series: p50 latency, input tokens, completed runs' },
  { token: 'chart-blue-deep', use: 'Lower segment of a stack topped by chart-blue' },
  { token: 'chart-amber', use: 'Second series beside blue: p95 latency, output tokens' },
  { token: 'chart-green', use: 'First scorer series, 2xx responses' },
  { token: 'chart-cyan', use: 'Standalone counts beside the status hues: cold starts' },
  { token: 'chart-purple', use: 'Cost, in tokens and currency' },
  { token: 'chart-orange', use: 'Scorer datasets, fourth scorer series' },
  { token: 'chart-pink', use: 'Errors, stacked on chart-blue-deep' },
  { token: 'chart-red', use: 'Errors, stacked on chart-blue' },
  ...[1, 2, 3, 4, 5].map(step => ({
    token: `chart-sequential-${step}`,
    use: step === 1 ? 'Ordered values, highest contrast against the page first' : '',
  })),
  { token: 'chart-sequential-pale', use: 'Secondary flow beside the sequential scale, same in both modes' },
  ...[1, 2, 3, 4, 5].map(step => ({
    token: `chart-share-${step}`,
    use: step === 1 ? 'Share list rows, in rank order: green, sky, violet, teal, indigo' : '',
  })),
  { token: 'chart-share-rest', use: 'Share list rows past the colored ones, folded into one gray' },
];

const spanRows: TokenRow[] = [
  ['agent', 'Agent'],
  ['workflow', 'Workflow'],
  ['model', 'Model'],
  ['mcp', 'MCP'],
  ['tool', 'Tool'],
  ['provider', 'Provider tool'],
  ['memory', 'Memory'],
  ['workspace', 'Workspace'],
  ['skill', 'Skill'],
  ['scorer', 'Scorer'],
  ['other', 'Other'],
].map(([span, label]) => ({ token: `span-${span}`, use: label }));

const brandRows: TokenRow[] = [
  ...['green', 'orange', 'pink', 'purple', 'blue', 'red', 'yellow'].map(hue => ({
    token: `color-brand-${hue}`,
    use: 'Fixed in both modes',
  })),
  { token: 'brand-green-indicator', use: 'Brand green for text and marks, readable in light mode' },
];

export const Monochrome: Story = {
  render: (_args, { globals }) => {
    const theme = themeOf(globals.theme);
    return (
      <FoundationPage
        eyebrow="Color"
        title="Monochrome"
        description="Backgrounds, grays and gray alpha. Gray measures contrast, not lightness, so its direction flips per mode."
      >
        <FoundationSection label="Ramps" description={countNote}>
          <RampGrid columns={grayColumns} rows={monochromeRows} theme={theme} />
        </FoundationSection>
      </FoundationPage>
    );
  },
};

export const Chromatic: Story = {
  render: (_args, { globals }) => {
    const theme = themeOf(globals.theme);
    return (
      <FoundationPage
        eyebrow="Color"
        title="Chromatic"
        description="Eight hues, each with a strong ramp and a lower-chroma soft ramp from 50 to 950."
      >
        <FoundationSection label="Ramps" description={countNote}>
          <RampGrid columns={steps} rows={chromaticRows} theme={theme} />
        </FoundationSection>
        <FoundationSection
          label="Strong or soft"
          description="Components use roles. This is for choosing the step behind a new role."
        >
          <dl className="grid max-w-180 grid-cols-[4rem_minmax(0,1fr)] gap-x-4 gap-y-2">
            {rampGuidance.map(({ ramp, use }) => (
              <div key={ramp} className="contents">
                <dt>
                  <Mono tone="ink">{ramp}</Mono>
                </dt>
                <dd>
                  <Txt variant="caption" tone="muted">
                    {use}
                  </Txt>
                </dd>
              </div>
            ))}
          </dl>
        </FoundationSection>
      </FoundationPage>
    );
  },
};

export const Semantic: Story = {
  render: (_args, { globals }) => {
    const theme = themeOf(globals.theme);
    return (
      <FoundationPage
        eyebrow="Color"
        title="Semantic"
        description="Surface and text roles. Status and badge roles live in Foundations/Status."
      >
        <FoundationSection label="Surfaces" description="Containers, outer to inner.">
          <TokenTable rows={surfaceRows} theme={theme} />
        </FoundationSection>
        <FoundationSection label="Text" description="Three tones. The distance between them is the hierarchy.">
          <TokenTable rows={textRows} theme={theme} />
        </FoundationSection>
      </FoundationPage>
    );
  },
};

export const Products: Story = {
  render: (_args, { globals }) => {
    const theme = themeOf(globals.theme);
    return (
      <FoundationPage
        eyebrow="Color"
        title="Products"
        description="Product identity, borrowed from the badge hues. Component examples live under Elements / Products."
      >
        <FoundationSection label="Roles" description="--product-{name}-{part}.">
          <MatrixTable
            rows={productRoles}
            columns={['base', 'foreground', 'subtle']}
            theme={theme}
            token={(role, part) => (part === 'base' ? `product-${role}` : `product-${role}-${part}`)}
          />
        </FoundationSection>
      </FoundationPage>
    );
  },
};

export const Charts: Story = {
  render: (_args, { globals }) => {
    const theme = themeOf(globals.theme);
    return (
      <FoundationPage
        eyebrow="Color"
        title="Charts"
        description="Categorical roles for distinct series, sequential steps for ordered values."
      >
        <FoundationSection label="Roles" description="Categorical first, then the sequential scale.">
          <TokenTable rows={chartRows} theme={theme} />
        </FoundationSection>
      </FoundationPage>
    );
  },
};

export const SpanTypes: Story = {
  name: 'Span types',
  render: (_args, { globals }) => {
    const theme = themeOf(globals.theme);
    return (
      <FoundationPage eyebrow="Color" title="Span types" description="Identity colors for spans in the trace timeline.">
        <FoundationSection label="Roles" description="One hue per span type, set per mode.">
          <TokenTable rows={spanRows} theme={theme} />
        </FoundationSection>
      </FoundationPage>
    );
  },
};

export const Brand: Story = {
  render: (_args, { globals }) => {
    const theme = themeOf(globals.theme);
    return (
      <FoundationPage
        eyebrow="Color"
        title="Brand"
        description="Mastra's brand palette. Separate from status and chart roles, and the same in both modes."
      >
        <FoundationSection label="Palette" description="Fixed values, not theme roles.">
          <TokenTable rows={brandRows} theme={theme} />
        </FoundationSection>
      </FoundationPage>
    );
  },
};
