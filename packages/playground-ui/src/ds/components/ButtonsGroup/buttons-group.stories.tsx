import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChevronDownIcon, CopyIcon, ScissorsIcon, ClipboardIcon, SearchIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../Button';
import { Combobox } from '../Combobox';
import { DropdownMenu } from '../DropdownMenu';
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

/**
 * A segmented view toggle: the selected segment is `default` (filled), the rest are `ghost`.
 * The group draws one continuous ring whether or not a segment is filled, and the seam between
 * two segments is a single pixel — never two stacked borders.
 */
export const AsSegmentedControl: Story = {
  render: function Render() {
    const [view, setView] = useState('list');
    return (
      <ButtonsGroup aria-label="View">
        {['list', 'board', 'calendar'].map(value => (
          <Button
            key={value}
            variant={view === value ? 'default' : 'ghost'}
            aria-pressed={view === value}
            onClick={() => setView(value)}
          >
            {value}
          </Button>
        ))}
      </ButtonsGroup>
    );
  },
};

/**
 * A split button: a primary action joined to a chevron that opens a real menu of related
 * actions. The chevron is a `DropdownMenu.Trigger asChild`, so it stays a real `Button` and
 * the group fuses the two into one pill with a single divider — no width or corner classes on
 * either segment. (`DropdownMenu` renders no DOM of its own, so the trigger is still a direct
 * child of the group; the menu content is portaled out.)
 */
export const AsSplitButton: Story = {
  render: () => (
    <ButtonsGroup>
      <Button>Save</Button>
      <DropdownMenu>
        <DropdownMenu.Trigger asChild>
          <Button aria-label="More save options">
            <ChevronDownIcon />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end">
          <DropdownMenu.Item>Save as draft</DropdownMenu.Item>
          <DropdownMenu.Item>Save and close</DropdownMenu.Item>
          <DropdownMenu.Item>Save a copy</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>
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

export const VerticalOutline: Story = {
  render: () => (
    <ButtonsGroup orientation="vertical">
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
    <ButtonsGroup>
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
    <ButtonsGroup>
      <ButtonsGroupText>https://</ButtonsGroupText>
      <Button variant="outline">example.com</Button>
    </ButtonsGroup>
  ),
};

/**
 * Search input + dropdown fused into a single pill — the recommended composition. The search
 * segment is an `InputGroup` (icon + input in one bordered box) nested inside the
 * `ButtonsGroup` merger; an interactive clear button would go in an `InputGroupAddon`
 * (`align="inline-end"`) with an `InputGroupButton`.
 *
 * No layout classes on the children (`flex-1`/`min-w-0`/`shrink-0`): the group owns sizing in
 * `spacing="close"` — the InputGroup fills the row and the Select trigger sizes to its content.
 * The group collapses the touching borders into a divider and flattens the inner corners,
 * leaving the outer pill rounded.
 *
 * Only one class is passed: `rounded-full` on the `SelectTrigger`, an intentional shape choice
 * so its outer corner matches the InputGroup pill (the trigger's standalone default is
 * `rounded-lg`). The `w-[420px]` on the group is just the demo container width.
 */
export const SearchWithDropdown: Story = {
  render: () => {
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState('recent');
    return (
      <ButtonsGroup className="w-105">
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
          <SelectTrigger aria-label="Sort by" size="lg" className="rounded-full">
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
 * Two field triggers joined — Studio's composer pairs a provider picker with a model picker
 * this way. A field's resting edge is its material's inset rim, which paints all four sides,
 * so the group flattens the material and gives both segments the border it can halve at the
 * seam. Hover and focus move that border instead of the rim.
 */
export const AsFieldPair: Story = {
  render: () => {
    const [provider, setProvider] = useState('openai');
    const [model, setModel] = useState('gpt-5');
    return (
      <ButtonsGroup>
        <Combobox
          value={provider}
          onValueChange={value => setProvider(String(value))}
          options={[
            { value: 'openai', label: 'OpenAI' },
            { value: 'anthropic', label: 'Anthropic' },
          ]}
          aria-label="Provider"
          className="w-auto"
        />
        <Combobox
          value={model}
          onValueChange={value => setModel(String(value))}
          options={[
            { value: 'gpt-5', label: 'gpt-5' },
            { value: 'gpt-5-mini', label: 'gpt-5-mini' },
          ]}
          aria-label="Model"
          className="w-auto"
        />
      </ButtonsGroup>
    );
  },
};
