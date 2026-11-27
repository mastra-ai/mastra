import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ComponentProps, ReactNode } from 'react';
import { expect, within } from 'storybook/test';

import { ActionRow } from '../ActionRow';
import { BrandLoader } from '../BrandLoader';
import { Breadcrumb, Crumb } from '../Breadcrumb';
import { Button } from '../Button';
import { EmptyState } from '../EmptyState';
import { Input } from '../Input';
import { Txt } from '../Txt';
import { PageLayout } from './index';
import type { PageLayoutPageProps } from './index';
import { IconArrowLeft } from '@/ds/icons/central/IconArrowLeft';
import { IconBox2 } from '@/ds/icons/central/IconBox2';
import { IconPlusMedium } from '@/ds/icons/central/IconPlusMedium';
import { MainCard } from '@/ds/new/layout/app-shell';
import { PageHeader } from '@/ds/new/layout/page-header';

function StoryFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-152 bg-sidebar p-2">
      <MainCard>{children}</MainCard>
    </div>
  );
}

const resources = ['Research agent', 'Support workflow', 'Knowledge search tool'];

const crumbs = (
  <Breadcrumb>
    <Crumb as="span">Workspace</Crumb>
    <Crumb as="span" isCurrent>
      Resources
    </Crumb>
  </Breadcrumb>
);

const headerActions = <Button>Docs</Button>;

const pageHeader = (
  <PageHeader>
    <PageHeader.Icon>
      <IconBox2 />
    </PageHeader.Icon>
    <PageHeader.Title>Resources</PageHeader.Title>
    <PageHeader.Description>Agents, workflows and tools available in this workspace.</PageHeader.Description>
    <PageHeader.Action>
      <Button icon={<IconPlusMedium />} variant="primary">
        Create resource
      </Button>
    </PageHeader.Action>
  </PageHeader>
);

const resourceList = (
  <ul className="grid gap-2">
    {resources.map(resource => (
      <li key={resource} className="rounded border border-border px-3 py-2">
        {resource}
      </li>
    ))}
  </ul>
);

const panels = (
  <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_16rem]">
    <ul className="grid content-start gap-2 overflow-y-auto border-r border-border p-4">
      {Array.from({ length: 40 }, (_, index) => (
        <li key={index} className="rounded border border-border px-3 py-2">
          Message {index + 1}
        </li>
      ))}
    </ul>
    <div className="p-4 text-placeholder">Side panel</div>
  </div>
);

const slotArg = { control: false } as const;

const meta = {
  title: 'Layout/PageLayout',
  component: PageLayout,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    controls: { include: ['variant', 'breadcrumbs', 'headerActions', 'actionRow', 'header', 'body', 'children'] },
    docs: {
      description: {
        component: [
          'The frame of every page: its width, gutter, scrolling and way back. Pick the `variant` that matches the page, and each variant takes only the props that make sense for it.',
          '- `variant="page"`: lists, dashboards, detail pages and explorers. Full width with the standard gutter, up to 1536px on very wide screens. Add `body="fixed"` when the body is panels that scroll on their own (chat, board, editor, graph): it fills the rest of the page edge to edge.',
          '- `variant="settings"`: a settings page. Breadcrumbs and a title over a 640px column of `SettingsGroup`s. See Layout/PageLayout/Settings.',
          '- `variant="form"`: a create or edit form. A back link and the title over a 640px column, and no breadcrumbs. See Layout/PageLayout/Form.',
          'The frame is configured, not composed: what goes inside (`PageHeader`, `SettingsGroup`, `EmptyState`, `DashboardGrid`, panels) stays free.',
        ].join('\n\n'),
      },
    },
  },
  decorators: [
    (Story, { parameters }) =>
      parameters.frame === false ? (
        <Story />
      ) : (
        <StoryFrame>
          <Story />
        </StoryFrame>
      ),
  ],
  args: { variant: 'page', breadcrumbs: crumbs, headerActions, children: resourceList },
  argTypes: {
    variant: { control: false },
    body: { control: 'inline-radio', options: ['scroll', 'fixed'] },
    breadcrumbs: slotArg,
    headerActions: slotArg,
    actionRow: slotArg,
    header: slotArg,
    children: slotArg,
  },
} satisfies Meta<PageLayoutPageProps>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Page: Story = {
  args: { header: pageHeader },
  parameters: {
    docs: {
      description: {
        story: 'A list page: breadcrumbs and actions in the top bar, a `PageHeader`, then the content, 24px below it.',
      },
    },
  },
};

export const FixedBody: Story = {
  args: { body: 'fixed', children: panels },
  parameters: {
    docs: {
      description: {
        story:
          'A body of panels that scroll on their own, like agent chat or a board. It fills the page edge to edge and the page itself never scrolls.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByText('Message 1').closest('ul');
    const body = list?.closest<HTMLElement>('[style*="overflow"]');
    await expect(list && list.scrollHeight > list.clientHeight).toBe(true);
    await expect(body && body.scrollHeight <= body.clientHeight).toBe(true);
  },
};

export const LongPage: Story = {
  args: { children: Array.from({ length: 20 }, (_, index) => <div key={index}>{resourceList}</div>) },
  parameters: {
    docs: {
      description: {
        story: 'A page taller than its frame scrolls to a plain edge, with no fade at the top or bottom.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement).getAllByText('Research agent')[0]?.closest<HTMLElement>('[style*="overflow"]');
    if (!body) throw new Error('Missing the scrolling body');
    await expect(body.scrollHeight).toBeGreaterThan(body.clientHeight);
    await expect(getComputedStyle(body).maskImage).toBe('none');
  },
};

export const PageWithFullHeightList: Story = {
  args: {
    children: (
      <ul className="border-border1 h-full overflow-auto rounded-lg border">
        {Array.from({ length: 40 }, (_, index) => (
          <li key={index} className="border-border1 border-b px-3 py-2 last:border-b-0">
            <Txt>Run {index + 1}</Txt>
          </li>
        ))}
      </ul>
    ),
  },
  parameters: {
    docs: {
      description: {
        story:
          'A last child that fills the page height and scrolls on its own, like a traces or logs table. It ends on the same gutter as its sides, without the end space a scrolling page gets.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByText('Run 1').closest('ul');
    const body = list?.closest<HTMLElement>('[style*="overflow"]');
    if (!list || !body) throw new Error('Missing the page parts');
    // The side gutter is the body's padding: on wide screens the content also centers, which is not part of it.
    const gutter = parseFloat(getComputedStyle(body).paddingLeft);
    await expect(body.getBoundingClientRect().bottom - list.getBoundingClientRect().bottom).toBeCloseTo(gutter, 0);
    await expect(body.scrollHeight).toBeLessThanOrEqual(body.clientHeight);
  },
};

export const PageWithActionRow: Story = {
  args: {
    actionRow: (
      <ActionRow>
        <ActionRow.Start>
          <Input placeholder="Filter resources" className="max-w-120" />
        </ActionRow.Start>
        <ActionRow.End>
          <Button>Sort</Button>
        </ActionRow.End>
      </ActionRow>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: 'Search and filters in `actionRow` stay pinned under the top bar while the content scrolls.',
      },
    },
  },
};

export const PageWithoutTopBar: Story = {
  args: { breadcrumbs: undefined, headerActions: undefined, header: pageHeader },
  parameters: {
    docs: {
      description: {
        story:
          'With no breadcrumbs and no header actions, the top bar is not drawn and the page starts with its header.',
      },
    },
  },
};

export const PageEmpty: Story = {
  args: {
    children: (
      <div className="flex h-full items-center justify-center">
        <EmptyState titleSlot="No resources yet" descriptionSlot="Create a resource to get started." />
      </div>
    ),
  },
};

export const PageWithSectionsAndEmptyState: Story = {
  args: {
    header: pageHeader,
    children: (
      <>
        <section>{resourceList}</section>
        <EmptyState
          variant="fill"
          titleSlot="No activity yet"
          descriptionSlot="Runs show up here once a resource is used."
        />
      </>
    ),
  },
  parameters: {
    docs: {
      description: {
        story:
          'A fill `EmptyState` as the last child takes the rest of the page height, so it centers below the content.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByText('Research agent').closest('section');
    const fill = canvasElement.querySelector<HTMLElement>('[data-slot="empty-state-fill"]');
    const body = fill?.closest<HTMLElement>('[style*="overflow"]');
    if (!list || !fill || !body) throw new Error('Missing the page parts');
    await expect(fill.getBoundingClientRect().top).toBeCloseTo(list.getBoundingClientRect().bottom, 0);
    await expect(body.scrollHeight).toBeLessThanOrEqual(body.clientHeight);
  },
};

async function expectLoaderInPageCenter({ canvasElement }: { canvasElement: HTMLElement }) {
  const card = canvasElement.querySelector('[data-slot=main-card]')?.getBoundingClientRect();
  const loader = within(canvasElement).getByRole('status').getBoundingClientRect();
  if (!card) throw new Error('Missing the page parts');
  await expect(loader.top + loader.height / 2).toBeCloseTo(card.top + card.height / 2, 0);
  await expect(loader.left + loader.width / 2).toBeCloseTo(card.left + card.width / 2, 0);
}

export const PageLoading: Story = {
  args: { children: <BrandLoader fill /> },
  parameters: {
    docs: {
      description: {
        story:
          "A page that hasn't shown yet centers its loader on the whole page, header included, so it takes over from the route's loader without a jump.",
      },
    },
  },
  play: expectLoaderInPageCenter,
};

export const FixedPageLoading: Story = {
  args: { body: 'fixed', children: <BrandLoader fill /> },
  play: expectLoaderInPageCenter,
};

function ComparisonHeader({
  eyebrow,
  spacing,
}: {
  eyebrow?: ReactNode;
  spacing?: ComponentProps<typeof PageHeader>['spacing'];
}) {
  return (
    <PageHeader spacing={spacing}>
      {eyebrow}
      <PageHeader.Title>Resources</PageHeader.Title>
      <PageHeader.Description>Page details.</PageHeader.Description>
      <PageHeader.Action>
        <Button>Edit</Button>
      </PageHeader.Action>
    </PageHeader>
  );
}

const backLink = (
  <PageHeader.Eyebrow>
    <a href="#resources">
      <IconArrowLeft aria-hidden />
      Back to resources
    </a>
  </PageHeader.Eyebrow>
);

export const TopBarSpacingComparison: Story = {
  parameters: {
    frame: false,
    docs: {
      description: {
        story: [
          'The first three panels intentionally align their page titles: a real bar with default spacing, a bar-less header with `spacing="breathing"`, and the same opt-in header with an eyebrow inside its reserved 40px band.',
          'Choose breathing spacing only when a specific bar-less page should match the title position of related pages with a bar. The fourth panel shows an equally valid choice: no bar and unchanged default spacing. Missing a bar does not automatically mean a page needs more space.',
          'Keep default spacing when breadcrumbs or header actions render the PageLayout bar, in compact action rows, or when another layout already supplies the gap. Breathing spacing is an explicit PageHeader choice; PageLayout does not enable or suppress it.',
        ].join('\n\n'),
      },
    },
  },
  render: () => (
    <div className="grid grid-cols-4">
      <div>
        <Txt variant="caption" tone="muted">
          With top bar (default)
        </Txt>
        <StoryFrame>
          <PageLayout variant="page" breadcrumbs={crumbs} headerActions={headerActions} header={<ComparisonHeader />}>
            {resourceList}
          </PageLayout>
        </StoryFrame>
      </div>
      <div>
        <Txt variant="caption" tone="muted">
          No bar + breathing spacing
        </Txt>
        <StoryFrame>
          <PageLayout variant="page" header={<ComparisonHeader spacing="breathing" />}>
            {resourceList}
          </PageLayout>
        </StoryFrame>
      </div>
      <div>
        <Txt variant="caption" tone="muted">
          No bar + breathing spacing + Back link
        </Txt>
        <StoryFrame>
          <PageLayout variant="page" header={<ComparisonHeader spacing="breathing" eyebrow={backLink} />}>
            {resourceList}
          </PageLayout>
        </StoryFrame>
      </div>
      <div>
        <Txt variant="caption" tone="muted">
          No bar (default unchanged)
        </Txt>
        <StoryFrame>
          <PageLayout variant="page" header={<ComparisonHeader />}>
            {resourceList}
          </PageLayout>
        </StoryFrame>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const layouts = canvasElement.querySelectorAll<HTMLElement>('[data-slot="page-layout"]');
    const offsets = Array.from(layouts, layout => {
      const title = layout.querySelector('[data-slot="page-header-title"]');
      if (!title) throw new Error('Missing page header title');
      const body = within(within(layout).getByRole('main')).getByRole('list');
      const top = layout.getBoundingClientRect().top;
      return {
        title: title.getBoundingClientRect().top - top,
        body: body.getBoundingClientRect().top - top,
      };
    });

    await expect(offsets.map(offset => offset.title)).toEqual([60, 60, 60, 20]);
    await expect(offsets.map(offset => offset.body)).toEqual([134, 134, 134, 94]);
  },
};
