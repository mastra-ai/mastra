import type { Meta, StoryObj } from '@storybook/react-vite';
import { Txt } from '../components/Txt/Txt';
import { Durations } from './animations';
import { FoundationPage, FoundationSection, Specimen } from './foundations-layout';

const meta: Meta = {
  title: 'Foundations/Motion',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Motion in the shell is a colour fade and nothing else. A duration is only legible in motion, so every specimen here fades on hover rather than printing a number.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

type DurationToken = (typeof Durations)[number];

const durationNotes: Record<DurationToken, string> = {
  fast: 'Control state: hover, press, focus',
  normal: 'A panel or card changing its own appearance',
  slow: 'Something the reader watches arrive or leave',
};

const easings = [{ token: '--ease-out-custom', note: 'Leaves fast, settles slow — the only curve' }];

const FadeBox = ({ duration, easing }: { duration: string; easing: string }) => (
  <div
    className="bg-fill hover:bg-fill-strong h-16 rounded-md"
    style={{ transitionProperty: 'background-color', transitionDuration: duration, transitionTimingFunction: easing }}
  />
);

export const MotionFoundations: Story = {
  name: 'Motion foundations',
  render: () => (
    <FoundationPage
      eyebrow={`Motion / ${Durations.length + easings.length} tokens`}
      title="Motion foundations"
      description="Hover each specimen: the only property the shell animates is colour. Nothing in a control moves, resizes or slides, so a fade is the whole motion language and a duration is the only choice left."
      note="Policy: colour fades only, --duration-fast for control state. Anything longer belongs to a surface arriving, not to a control reacting."
      noteAside="Utilities: duration-fast / duration-normal / duration-slow, ease-out-custom."
    >
      <FoundationSection
        label="Durations"
        description="Three rungs. A control answers in --duration-fast; slower reads as lag, not polish."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Durations.map(token => (
            <Specimen key={token} name={`--duration-${token}`} note={durationNotes[token]}>
              <FadeBox duration={`var(--duration-${token})`} easing="var(--ease-out-custom)" />
            </Specimen>
          ))}
        </div>
        <Txt variant="caption" tone="muted">
          All three carry the same curve, so the difference you feel is the duration alone.
        </Txt>
      </FoundationSection>

      <FoundationSection
        label="Easings"
        description="One curve for everything, applied here over --duration-slow so the shape of the fade is visible."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {easings.map(easing => (
            <Specimen key={easing.token} name={easing.token} note={easing.note}>
              <FadeBox duration="var(--duration-slow)" easing={`var(${easing.token})`} />
            </Specimen>
          ))}
        </div>
      </FoundationSection>
    </FoundationPage>
  ),
};
