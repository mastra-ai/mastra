import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChevronDownIcon, CopyIcon, ScissorsIcon, ClipboardIcon, SearchIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../Button';
import { Input } from '../Input';
import { InputGroup, InputGroupAddon, InputGroupInput } from '../InputGroup';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../Select';
import { ButtonsGroup, ButtonsGroupSeparator, ButtonsGroupText } from './buttons-group';

const meta: Meta<typeof ButtonsGroup> = {
  title: 'Composite/ButtonsGroup',
  component: ButtonsGroup,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof ButtonsGroup>;

export const Default: Story = {
  render: () => (
    <ButtonsGroup>
      <Button>Button 1</Button>
      <Button>Button 2</Button>
      <Button>Button 3</Button>
    </ButtonsGroup>
  ),
};

export const DefaultSpacing: Story = {
  render: () => (
    <ButtonsGroup>
      <Button>Cancel</Button>
      <Button>Save</Button>
    </ButtonsGroup>
  ),
};

export const CloseSpacing: Story = {
  render: () => (
    <ButtonsGroup spacing="close">
      <Button>Cancel</Button>
      <Button>Save</Button>
    </ButtonsGroup>
  ),
};

export const AsSplitButton: Story = {
  render: () => (
    <ButtonsGroup spacing="close">
      <Button>Cancel</Button>
      <Button aria-label="Open Menu">
        <ChevronDownIcon />
      </Button>
    </ButtonsGroup>
  ),
};

export const Vertical: Story = {
  render: () => (
    <ButtonsGroup orientation="vertical">
      <Button>Top</Button>
      <Button>Middle</Button>
      <Button>Bottom</Button>
    </ButtonsGroup>
  ),
};

export const VerticalCloseSpacing: Story = {
  render: () => (
    <ButtonsGroup orientation="vertical" spacing="close">
      <Button variant="outline">
        <CopyIcon />
        Copy
      </Button>
      <Button variant="outline">
        <ScissorsIcon />
        Cut
      </Button>
      <Button variant="outline">
        <ClipboardIcon />
        Paste
      </Button>
    </ButtonsGroup>
  ),
};

export const WithSeparator: Story = {
  render: () => (
    <ButtonsGroup>
      <Button variant="ghost">
        <CopyIcon />
        Copy
      </Button>
      <ButtonsGroupSeparator />
      <Button variant="ghost">
        <ScissorsIcon />
        Cut
      </Button>
      <ButtonsGroupSeparator />
      <Button variant="ghost">
        <ClipboardIcon />
        Paste
      </Button>
    </ButtonsGroup>
  ),
};

export const VerticalWithSeparator: Story = {
  render: () => (
    <ButtonsGroup orientation="vertical">
      <Button variant="ghost">
        <CopyIcon />
        Copy
      </Button>
      <ButtonsGroupSeparator />
      <Button variant="ghost">
        <ScissorsIcon />
        Cut
      </Button>
      <ButtonsGroupSeparator />
      <Button variant="ghost">
        <ClipboardIcon />
        Paste
      </Button>
    </ButtonsGroup>
  ),
};

/**
 * A stepper: two outline buttons joined to a read-only value segment. The middle value
 * uses `ButtonsGroupText` (a filled chip). Because that segment is filled (opaque bg) the
 * group keeps its own border as the seam, so both dividers render as a single clean line.
 */
export const Stepper: Story = {
  render: () => (
    <ButtonsGroup spacing="close">
      <Button variant="outline" aria-label="Decrement">
        −
      </Button>
      <ButtonsGroupText>42</ButtonsGroupText>
      <Button variant="outline" aria-label="Increment">
        +
      </Button>
    </ButtonsGroup>
  ),
};

/** `ButtonsGroupText` as an actual text label segment (e.g. a unit) next to a control. */
export const WithText: Story = {
  render: () => (
    <ButtonsGroup spacing="close">
      <ButtonsGroupText>https://</ButtonsGroupText>
      <Button variant="outline">example.com</Button>
    </ButtonsGroup>
  ),
};

/**
 * Searchbar + dropdown fused into a single pill — the recommended composition.
 *
 * No layout classes on the children: the group owns sizing in `spacing="close"` — the
 * Input fills the row, the Select trigger sizes to its content. The group also collapses
 * the touching borders into a divider and flattens the inner corners, leaving the outer
 * pill rounded. The search icon lives in the Input via `leadingIcon`; the clear button
 * via `trailingIcon`.
 *
 * Only one class is passed: `rounded-full` on the `SelectTrigger`, an intentional shape
 * choice so its outer corner matches the Input pill (the trigger's standalone default is
 * `rounded-lg`). The `w-[420px]` on the group is just the demo container width.
 */
export const SearchWithDropdown: Story = {
  render: () => {
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState('recent');
    return (
      <ButtonsGroup spacing="close" className="w-[420px]">
        <Input
          variant="outline"
          size="md"
          type="search"
          aria-label="Search projects"
          placeholder="Search projects..."
          leadingIcon={<SearchIcon />}
          trailingIcon={
            search ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearch('')}
                className="flex items-center text-neutral3 hover:text-neutral6"
              >
                <XIcon className="size-4" />
              </button>
            ) : undefined
          }
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger size="md" aria-label="Sort by" className="rounded-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="recent">Most recent</SelectItem>
            <SelectItem value="oldest">Oldest</SelectItem>
            <SelectItem value="name">Name</SelectItem>
          </SelectContent>
        </Select>
      </ButtonsGroup>
    );
  },
};

/**
 * Same result, but the search segment reuses the addon-box `InputGroup` (icon + input in
 * one bordered box) nested inside the `ButtonsGroup` merger. Use this when the search
 * segment needs the richer addon-box features (block addons, Kbd, steppers). For a plain
 * leading icon, prefer `SearchWithDropdown` above.
 *
 * Note there are no `flex-1`/`min-w-0`/`shrink-0` classes: the InputGroup fills the row
 * on its own and the group sizes the Select trigger to content.
 */
export const SearchWithDropdownUsingInputGroup: Story = {
  render: () => {
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState('recent');
    return (
      <ButtonsGroup spacing="close" className="w-[420px]">
        <InputGroup variant="outline" size="md">
          <InputGroupAddon align="inline-start">
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            aria-label="Search projects"
            placeholder="Search projects..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </InputGroup>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger size="md" aria-label="Sort by" className="rounded-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="recent">Most recent</SelectItem>
            <SelectItem value="oldest">Oldest</SelectItem>
            <SelectItem value="name">Name</SelectItem>
          </SelectContent>
        </Select>
      </ButtonsGroup>
    );
  },
};
