import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

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
    <div className="flex h-64 w-96 items-center justify-center rounded-lg bg-background">
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
          <span className="text-caption text-muted-foreground">
            size=&quot;{size}&quot; · {SIZE_PX[size]}px (per-size stroke)
          </span>
          <div className="relative" style={{ width: SIZE_PX[size], aspectRatio: '34 / 21' }}>
            <LogoWithoutText className="absolute inset-0 size-full text-destructive-edge" aria-hidden />
            <div className="absolute inset-0">
              <BrandLoader size={size} aria-label={`BrandLoader overlay ${size}`} className="size-full" />
            </div>
          </div>
        </div>
      ))}
      {[240, 400, 640].map(px => (
        <div key={px} className="flex flex-col items-center gap-2">
          <span className="text-caption text-muted-foreground">{px}px (uses lg stroke via className)</span>
          <div className="relative" style={{ width: px, aspectRatio: '34 / 21' }}>
            <LogoWithoutText className="absolute inset-0 size-full text-destructive-edge" aria-hidden />
            <div className="absolute inset-0">
              <BrandLoader aria-label="BrandLoader overlay" className="size-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  ),
};

export const Fill: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => (
    <div className="h-120 border border-dashed border-border">
      <BrandLoader fill />
    </div>
  ),
};

/**
 * `fill="screen"` centers it in the window, as on app boot.
 */
export const FullHeightPage: Story = {
  parameters: {
    layout: 'fullscreen',
  },
  render: () => (
    <div className="bg-sidebar">
      <BrandLoader fill="screen" aria-label="Loading app" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const loader = within(canvasElement).getByRole('status', { name: 'Loading app' }).getBoundingClientRect();
    await expect(loader.top + loader.height / 2).toBeCloseTo(window.innerHeight / 2, 0);
    await expect(loader.left + loader.width / 2).toBeCloseTo(document.documentElement.clientWidth / 2, 0);
  },
};
