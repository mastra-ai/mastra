import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

import { AgentIcon } from '../../icons/AgentIcon';
import { DividerIcon } from '../../icons/DividerIcon';
import { Icon } from '../../icons/Icon';
import { Crumb } from '../Breadcrumb/Breadcrumb';
import { Breadcrumb } from '../Breadcrumb/Breadcrumb';
import { Button } from '../Button';

import { Header, HeaderAction, HeaderGroup, HeaderTitle } from './Header';

const Example = () => {
  return (
    <div className="mx-auto w-full max-w-screen-lg space-y-4 py-12">
      <div>
        <Header>
          <HeaderTitle>Projects</HeaderTitle>
          <HeaderAction>
            <Button>Add project</Button>
          </HeaderAction>
        </Header>
      </div>

      <div>
        <Header>
          <Breadcrumb>
            <Crumb as="a" href="/">
              <Icon>
                <AgentIcon />
              </Icon>
            </Crumb>
            <Crumb as="a" href="/projects">
              Projects
            </Crumb>
            <Crumb as="a" href="/projects/1" isCurrent>
              Project 1
            </Crumb>
          </Breadcrumb>
          <HeaderAction>
            <Button>Add project</Button>
          </HeaderAction>
        </Header>
      </div>

      <div>
        <Header>
          <Breadcrumb>
            <Crumb as="a" href="/projects">
              Projects
            </Crumb>
            <Crumb as="a" href="/projects/1" isCurrent>
              Project 1
            </Crumb>
          </Breadcrumb>

          <HeaderGroup>
            <Button>Overview</Button>
            <Button>Chat</Button>
            <DividerIcon className="text-icon3" />
            <Button>Traces</Button>
            <Button>Score</Button>
          </HeaderGroup>

          <HeaderAction>
            <Button>Add project</Button>
          </HeaderAction>
        </Header>
      </div>
    </div>
  );
};

// More on how to set up stories at: https://storybook.js.org/docs/writing-stories#default-export
const meta = {
  title: 'Primitives/Header',
  component: Example,
  parameters: {
    // Optional parameter to center the component in the Canvas. More info: https://storybook.js.org/docs/configure/story-layout
    layout: 'fullscreen',
  },
  // More on argTypes: https://storybook.js.org/docs/api/argtypes
  argTypes: {},

  args: {},
} satisfies Meta<typeof Example>;

export default meta;
type Story = StoryObj<typeof meta>;

// More on writing stories with args: https://storybook.js.org/docs/writing-stories/args
export const All: Story = {
  args: {
    primary: true,
    label: 'Header',
  },
};
