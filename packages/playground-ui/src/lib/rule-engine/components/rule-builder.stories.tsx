import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import type { RuleGroup } from '../types';

import { RuleBuilder } from './rule-builder';
import type { JsonSchema } from './types';
import { complexSchema } from './fixtures';
import { TooltipProvider } from '@/ds/components/Tooltip';

const meta: Meta<typeof RuleBuilder> = {
  title: 'Rule Engine/RuleBuilder',
  component: RuleBuilder,
  decorators: [
    Story => (
      <TooltipProvider>
        <Story />
      </TooltipProvider>
    ),
  ],
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof RuleBuilder>;

// Simple flat schema
const simpleSchema: JsonSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', title: 'Name' },
    age: { type: 'number', title: 'Age' },
    country: { type: 'string', title: 'Country' },
    isActive: { type: 'boolean', title: 'Is Active' },
  },
};

// Nested schema with user object
const nestedSchema: JsonSchema = {
  type: 'object',
  properties: {
    user: {
      type: 'object',
      title: 'User',
      properties: {
        email: { type: 'string', title: 'Email' },
        profile: {
          type: 'object',
          title: 'Profile',
          properties: {
            firstName: { type: 'string', title: 'First Name' },
            lastName: { type: 'string', title: 'Last Name' },
            age: { type: 'number', title: 'Age' },
          },
        },
        settings: {
          type: 'object',
          title: 'Settings',
          properties: {
            newsletter: { type: 'boolean', title: 'Newsletter' },
            theme: { type: 'string', title: 'Theme' },
          },
        },
      },
    },
    subscription: {
      type: 'object',
      title: 'Subscription',
      properties: {
        plan: { type: 'string', title: 'Plan' },
        status: { type: 'string', title: 'Status' },
      },
    },
    country: { type: 'string', title: 'Country' },
  },
};

// Wrapper component to manage state
const RuleBuilderWithState = ({ schema, initialRuleGroup }: { schema: JsonSchema; initialRuleGroup?: RuleGroup }) => {
  const [ruleGroup, setRuleGroup] = React.useState<RuleGroup | undefined>(initialRuleGroup);

  return (
    <div className="w-[600px]">
      <RuleBuilder schema={schema} ruleGroup={ruleGroup} onChange={setRuleGroup} />
      {ruleGroup && (
        <div className="mt-4 p-3 bg-surface3 rounded-md">
          <p className="text-xs text-neutral3 mb-2">Current rule group:</p>
          <pre className="text-xs text-neutral5 overflow-auto">{JSON.stringify(ruleGroup, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export const Default: Story = {
  render: () => <RuleBuilderWithState schema={simpleSchema} />,
};

export const WithInitialRules: Story = {
  render: () => (
    <RuleBuilderWithState
      schema={simpleSchema}
      initialRuleGroup={{
        operator: 'AND',
        conditions: [
          { field: 'country', operator: 'equals', value: 'US' },
          { field: 'age', operator: 'greater_than', value: 18 },
        ],
      }}
    />
  ),
};

export const NestedFields: Story = {
  render: () => <RuleBuilderWithState schema={nestedSchema} />,
};

export const NestedFieldsWithRules: Story = {
  render: () => (
    <RuleBuilderWithState
      schema={nestedSchema}
      initialRuleGroup={{
        operator: 'AND',
        conditions: [
          { field: 'user.email', operator: 'contains', value: '@gmail' },
          { field: 'user.profile.age', operator: 'greater_than', value: 21 },
          { field: 'subscription.plan', operator: 'in', value: ['pro', 'enterprise'] },
        ],
      }}
    />
  ),
};

export const ComplexSchema: Story = {
  render: () => <RuleBuilderWithState schema={complexSchema} />,
};

export const AllOperators: Story = {
  render: () => (
    <RuleBuilderWithState
      schema={simpleSchema}
      initialRuleGroup={{
        operator: 'AND',
        conditions: [
          { field: 'name', operator: 'equals', value: 'John' },
          { field: 'name', operator: 'not_equals', value: 'Jane' },
          { field: 'name', operator: 'contains', value: 'oh' },
          { field: 'name', operator: 'not_contains', value: 'xx' },
          { field: 'age', operator: 'greater_than', value: 18 },
          { field: 'age', operator: 'less_than', value: 65 },
          { field: 'country', operator: 'in', value: ['US', 'CA', 'UK'] },
          { field: 'country', operator: 'not_in', value: ['RU', 'CN'] },
        ],
      }}
    />
  ),
};

export const EmptySchema: Story = {
  render: () => <RuleBuilderWithState schema={{ type: 'object', properties: {} }} />,
};

export const NestedGroups: Story = {
  render: () => (
    <RuleBuilderWithState
      schema={simpleSchema}
      initialRuleGroup={{
        operator: 'AND',
        conditions: [
          { field: 'country', operator: 'equals', value: 'US' },
          {
            operator: 'OR',
            conditions: [
              { field: 'age', operator: 'greater_than', value: 18 },
              { field: 'name', operator: 'contains', value: 'admin' },
            ],
          },
          { field: 'isActive', operator: 'equals', value: true },
        ],
      }}
    />
  ),
};

export const DeeplyNested: Story = {
  render: () => (
    <RuleBuilderWithState
      schema={simpleSchema}
      initialRuleGroup={{
        operator: 'AND',
        conditions: [
          { field: 'country', operator: 'equals', value: 'US' },
          {
            operator: 'OR',
            conditions: [
              { field: 'age', operator: 'greater_than', value: 18 },
              {
                operator: 'AND',
                conditions: [
                  { field: 'name', operator: 'contains', value: 'admin' },
                  { field: 'isActive', operator: 'equals', value: true },
                ],
              },
            ],
          },
        ],
      }}
    />
  ),
};
