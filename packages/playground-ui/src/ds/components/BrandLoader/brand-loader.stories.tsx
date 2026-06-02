import type { Meta, StoryObj } from '@storybook/react-vite';

import { LogoWithoutText } from '../Logo/MastraLogo';

import { BrandLoader } from './brand-loader';

const meta: Meta<typeof BrandLoader> = {
  title: 'Elements/BrandLoader',
  component: BrandLoader,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    size: {
      control: { type: 'radio' },
      options: ['sm', 'md', 'lg'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof BrandLoader>;

export const Default: Story = {
  args: {},
};

export const Small: Story = {
  args: { size: 'sm' },
};

export const Medium: Story = {
  args: { size: 'md' },
};

export const Large: Story = {
  args: { size: 'lg' },
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-8">
      <BrandLoader size="sm" />
      <BrandLoader size="md" />
      <BrandLoader size="lg" />
    </div>
  ),
};

export const OnSurface: Story = {
  render: () => (
    <div className="flex h-64 w-96 items-center justify-center rounded-lg bg-surface2">
      <BrandLoader size="lg" />
    </div>
  ),
};

/**
 * Overlays the animated `BrandLoader` on top of the static `LogoWithoutText`
 * (rendered in red) so disk positions, radii, and ridge thickness can be
 * compared pixel-for-pixel. Both SVGs share the same `viewBox="0 0 34 21"`.
 */
const SIZE_PX = { sm: 24, md: 32, lg: 40 } as const;

export const SuperposedOnLogo: Story = {
  parameters: { layout: 'centered' },
  render: () => (
    <div className="flex flex-col items-center gap-10">
      {(['sm', 'md', 'lg'] as const).map(size => (
        <div key={size} className="flex flex-col items-center gap-2">
          <span className="text-ui-sm text-neutral3">
            size=&quot;{size}&quot; · {SIZE_PX[size]}px (per-size stroke)
          </span>
          <div className="relative" style={{ width: SIZE_PX[size], aspectRatio: '34 / 21' }}>
            <LogoWithoutText className="absolute inset-0 h-full w-full text-[#ef4444]/70" aria-hidden />
            <div className="absolute inset-0">
              <BrandLoader size={size} aria-label={`BrandLoader overlay ${size}`} className="h-full w-full" />
            </div>
          </div>
        </div>
      ))}
      {[240, 400, 640].map(px => (
        <div key={px} className="flex flex-col items-center gap-2">
          <span className="text-ui-sm text-neutral3">{px}px (uses lg stroke via className)</span>
          <div className="relative" style={{ width: px, aspectRatio: '34 / 21' }}>
            <LogoWithoutText className="absolute inset-0 h-full w-full text-[#ef4444]/70" aria-hidden />
            <div className="absolute inset-0">
              <BrandLoader aria-label="BrandLoader overlay" className="h-full w-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  ),
};

/**
 * Renders the `BrandLoader` centered in a full-viewport container to preview
 * the brand moment as it appears on app boot.
 */
export const FullHeightPage: Story = {
  parameters: {
    layout: 'fullscreen',
  },
  render: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-surface1">
      <BrandLoader size="lg" aria-label="Loading app" />
    </div>
  ),
};
