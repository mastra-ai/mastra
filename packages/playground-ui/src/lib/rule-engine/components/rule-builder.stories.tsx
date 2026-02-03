import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import type { Rule } from '../types';

import { RuleBuilder } from './rule-builder';
import type { JsonSchema } from './types';

const meta: Meta<typeof RuleBuilder> = {
  title: 'Rule Engine/RuleBuilder',
  component: RuleBuilder,
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

// Complex schema with arrays
const complexSchema: JsonSchema = {
  type: 'object',
  properties: {
    user: {
      type: 'object',
      title: 'User',
      properties: {
        email: { type: 'string', title: 'Email' },
        roles: {
          type: 'array',
          title: 'Roles',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', title: 'Role Name' },
              permissions: { type: 'string', title: 'Permissions' },
            },
          },
        },
        address: {
          type: 'object',
          title: 'Address',
          properties: {
            street: { type: 'string', title: 'Street' },
            city: { type: 'string', title: 'City' },
            country: { type: 'string', title: 'Country' },
            zipCode: { type: 'string', title: 'Zip Code' },
          },
        },
      },
    },
    metadata: {
      type: 'object',
      title: 'Metadata',
      properties: {
        createdAt: { type: 'string', title: 'Created At' },
        updatedAt: { type: 'string', title: 'Updated At' },
        version: { type: 'number', title: 'Version' },
      },
    },
  },
};

// Wrapper component to manage state
const RuleBuilderWithState = ({ schema, initialRules = [] }: { schema: JsonSchema; initialRules?: Rule[] }) => {
  const [rules, setRules] = React.useState<Rule[]>(initialRules);

  return (
    <div className="w-[600px]">
      <RuleBuilder schema={schema} rules={rules} onChange={setRules} />
      {rules.length > 0 && (
        <div className="mt-4 p-3 bg-surface3 rounded-md">
          <p className="text-xs text-neutral3 mb-2">Current rules:</p>
          <pre className="text-xs text-neutral5 overflow-auto">{JSON.stringify(rules, null, 2)}</pre>
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
      initialRules={[
        { field: 'country', operator: 'equals', value: 'US' },
        { field: 'age', operator: 'greater_than', value: 18 },
      ]}
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
      initialRules={[
        { field: 'user.email', operator: 'contains', value: '@gmail' },
        { field: 'user.profile.age', operator: 'greater_than', value: 21 },
        { field: 'subscription.plan', operator: 'in', value: ['pro', 'enterprise'] },
      ]}
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
      initialRules={[
        { field: 'name', operator: 'equals', value: 'John' },
        { field: 'name', operator: 'not_equals', value: 'Jane' },
        { field: 'name', operator: 'contains', value: 'oh' },
        { field: 'name', operator: 'not_contains', value: 'xx' },
        { field: 'age', operator: 'greater_than', value: 18 },
        { field: 'age', operator: 'less_than', value: 65 },
        { field: 'country', operator: 'in', value: ['US', 'CA', 'UK'] },
        { field: 'country', operator: 'not_in', value: ['RU', 'CN'] },
      ]}
    />
  ),
};

export const EmptySchema: Story = {
  render: () => <RuleBuilderWithState schema={{ type: 'object', properties: {} }} />,
};
