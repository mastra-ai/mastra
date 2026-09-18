import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

import { BreadcrumbBar } from './breadcrumb-bar';
import { useBreadcrumbBarCrumb } from './breadcrumb-bar-context';
import { Button } from '@/ds/components/Button';

function StoryLink({ to, ...props }: ComponentPropsWithoutRef<'a'> & { to?: string }) {
  return <a href={to} {...props} />;
}

function ExampleCrumb({ children }: { children: ReactNode }) {
  const crumb = useBreadcrumbBarCrumb();
  const isLeaf = crumb?.isLeaf ?? false;

  return (
    <BreadcrumbBar.Crumb as={isLeaf ? 'span' : StoryLink} to={isLeaf ? undefined : crumb?.pathname} isCurrent={isLeaf}>
      {children}
    </BreadcrumbBar.Crumb>
  );
}

const meta = {
  title: 'Layout/BreadcrumbBar',
  component: BreadcrumbBar,
  parameters: { layout: 'fullscreen' },
  args: { children: null },
} satisfies Meta<typeof BreadcrumbBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <BreadcrumbBar actions={<Button size="sm">Create agent</Button>}>
      <BreadcrumbBar.Item pathname="/agents">
        <ExampleCrumb>Agents</ExampleCrumb>
      </BreadcrumbBar.Item>
      <BreadcrumbBar.Item pathname="/agents/research">
        <ExampleCrumb>Research agent</ExampleCrumb>
      </BreadcrumbBar.Item>
    </BreadcrumbBar>
  ),
};

export const ProjectSwitcher: Story = {
  render: () => (
    <BreadcrumbBar actions={<Button size="sm">Deploy</Button>}>
      <BreadcrumbBar.Item pathname="/projects">
        <ExampleCrumb>Projects</ExampleCrumb>
      </BreadcrumbBar.Item>
      <BreadcrumbBar.Item pathname="/projects/production">
        <BreadcrumbBar.SwitcherCrumb>Production project</BreadcrumbBar.SwitcherCrumb>
      </BreadcrumbBar.Item>
    </BreadcrumbBar>
  ),
};

export const ChevronSeparators: Story = {
  render: () => (
    <BreadcrumbBar separator="chevron" actions={<Button size="sm">Deploy</Button>}>
      <BreadcrumbBar.Item pathname="/projects">
        <ExampleCrumb>Projects</ExampleCrumb>
      </BreadcrumbBar.Item>
      <BreadcrumbBar.Item pathname="/projects/production">
        <BreadcrumbBar.SwitcherCrumb>Production project</BreadcrumbBar.SwitcherCrumb>
      </BreadcrumbBar.Item>
    </BreadcrumbBar>
  ),
};
