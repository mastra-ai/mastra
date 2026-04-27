import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { SearchFieldBlock } from '../fields/search-field-block';
import { SelectFieldBlock } from '../fields/select-field-block';
import { TextFieldBlock } from '../fields/text-field-block';
import { FieldBlocksLayout } from './field-blocks-layout';

const roleOptions = [
  { value: 'admin', label: 'Admin' },
  { value: 'editor', label: 'Editor' },
  { value: 'viewer', label: 'Viewer' },
];

const departmentOptions = [
  { value: 'engineering', label: 'Engineering' },
  { value: 'design', label: 'Design' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'sales', label: 'Sales' },
];

const meta: Meta = {
  title: 'FormFieldBlocks/FieldBlocksLayout',
  parameters: {
    layout: 'centered',
  },
  decorators: [
    Story => (
      <div style={{ width: 600 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;

function SingleColumnExample() {
  const [role, setRole] = useState('');

  return (
    <FieldBlocksLayout columns={1}>
      <TextFieldBlock name="fullName" label="Full Name" required placeholder="John Doe" />
      <TextFieldBlock name="email" label="Email" placeholder="john@example.com" />
      <SelectFieldBlock
        name="role"
        label="Role"
        options={roleOptions}
        value={role}
        onValueChange={setRole}
        placeholder="Select a role"
      />
    </FieldBlocksLayout>
  );
}

export const SingleColumn: StoryObj = {
  name: 'Single Column',
  render: () => <SingleColumnExample />,
};

function TwoColumnsExample() {
  const [role, setRole] = useState('');
  const [department, setDepartment] = useState('');

  return (
    <FieldBlocksLayout columns={2}>
      <FieldBlocksLayout.Column>
        <TextFieldBlock name="firstName" label="First Name" required placeholder="John" />
        <TextFieldBlock name="email" label="Email" placeholder="john@example.com" />
        <SelectFieldBlock
          name="role"
          label="Role"
          options={roleOptions}
          value={role}
          onValueChange={setRole}
          placeholder="Select a role"
        />
      </FieldBlocksLayout.Column>
      <FieldBlocksLayout.Column>
        <TextFieldBlock name="lastName" label="Last Name" required placeholder="Doe" />
        <TextFieldBlock name="phone" label="Phone" placeholder="+1 555 123 4567" />
        <SelectFieldBlock
          name="department"
          label="Department"
          options={departmentOptions}
          value={department}
          onValueChange={setDepartment}
          placeholder="Select a department"
        />
      </FieldBlocksLayout.Column>
    </FieldBlocksLayout>
  );
}

export const TwoColumns: StoryObj = {
  name: 'Two Columns',
  render: () => <TwoColumnsExample />,
};

function MixedExample() {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [department, setDepartment] = useState('');

  return (
    <FieldBlocksLayout columns={1}>
      <SearchFieldBlock
        name="search"
        label="Search"
        labelIsHidden
        placeholder="Search users..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        onReset={() => setSearch('')}
      />
      <FieldBlocksLayout columns={2}>
        <FieldBlocksLayout.Column>
          <TextFieldBlock name="firstName" label="First Name" required placeholder="John" />
          <TextFieldBlock
            name="email"
            label="Email"
            placeholder="john@example.com"
            helpText="We will use this for notifications."
          />
        </FieldBlocksLayout.Column>
        <FieldBlocksLayout.Column>
          <TextFieldBlock name="lastName" label="Last Name" required placeholder="Doe" />
          <SelectFieldBlock
            name="role"
            label="Role"
            required
            options={roleOptions}
            value={role}
            onValueChange={setRole}
            placeholder="Select a role"
          />
        </FieldBlocksLayout.Column>
      </FieldBlocksLayout>
      <SelectFieldBlock
        name="department"
        label="Department"
        options={departmentOptions}
        value={department}
        onValueChange={setDepartment}
        placeholder="Select a department"
      />
    </FieldBlocksLayout>
  );
}

export const Mixed: StoryObj = {
  name: 'Mixed Layout',
  render: () => <MixedExample />,
};
