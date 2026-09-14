import type { Meta, StoryObj } from '@storybook/react-vite';
import { FocusTabs, FocusTable } from '../../../../.storybook/fixtures/focus/collections';
import {
  FocusCheckboxes,
  FocusSwitches,
  FocusRadios,
  FocusButtons,
  FocusInputs,
  FocusInputGroups,
  FocusSliders,
} from '../../../../.storybook/fixtures/focus/controls';
import { FocusComboboxes, FocusSelects, FocusDropdownMenu } from '../../../../.storybook/fixtures/focus/menus';
import { SectionCard } from '@/ds/components/SectionCard';

const meta = {
  title: 'Foundations/Keyboard focus',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;
export default meta;

export const GradientLines: StoryObj = {
  render: () => (
    <main className="text-ui-smd text-neutral5 mx-auto grid max-w-6xl gap-6 p-4 sm:p-8">
      <header className="grid gap-2">
        <h1 className="text-header-md text-neutral6">Gradient keyboard focus</h1>
        <p className="text-ui-smd text-neutral3 max-w-2xl">
          Click to edit. Tab to navigate. Each indicator follows the component shape, fades at both ends, and leaves
          selection visible.
        </p>
      </header>
      <div className="grid items-start gap-6 md:grid-cols-2 lg:grid-cols-3">
        <SectionCard title="Fields" description="The line grows beneath the content.">
          <FocusInputs />
        </SectionCard>
        <SectionCard title="Actions" description="Every button appearance keeps a visible cue.">
          <FocusButtons />
        </SectionCard>
        <SectionCard title="Selections" description="Space toggles. Arrows move within a radio group.">
          <div className="grid gap-8">
            <FocusCheckboxes />
            <FocusSwitches />
            <FocusRadios />
          </div>
        </SectionCard>
        <SectionCard title="Navigation" description="Arrows move focus. Enter activates a tab.">
          <FocusTabs />
        </SectionCard>
        <SectionCard title="Sliders" description="The notch follows each focused thumb.">
          <FocusSliders />
        </SectionCard>
        <SectionCard title="Tables" description="The entire focused row is marked.">
          <FocusTable />
        </SectionCard>
        <SectionCard title="Grouped fields">
          <FocusInputGroups />
        </SectionCard>
        <SectionCard title="Pickers">
          <div className="grid gap-6">
            <FocusSelects />
            <FocusComboboxes />
          </div>
        </SectionCard>
        <SectionCard title="Menus">
          <FocusDropdownMenu />
        </SectionCard>
      </div>
    </main>
  ),
};

export const Light: StoryObj = {
  ...GradientLines,
  globals: { backgrounds: { value: 'light' } },
};
