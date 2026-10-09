import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ModelSetupPreset } from '../services/modelSetupPreset';
import type { FigureMode } from '../figures/types';
import { OnboardingAccountLabels } from './OnboardingAccountLabels';
import { OnboardingSessionLabels } from './OnboardingSessionLabels';

export function OnboardingPresetPreview({ preset }: { preset: ModelSetupPreset }) {
  const mode: FigureMode = preset.kind === 'individual' ? 'individual' : preset.allowPersonal ? 'hybrid' : 'shared';
  const copy = {
    shared: {
      title: 'One company account',
      detail: 'Shared work and sessions use the same account.',
      label: 'A single company supply feeds every work session',
    },
    hybrid: {
      title: 'Company + personal access',
      detail: 'Shared work uses the company account. Personal sessions can use your own.',
      label: 'A company supply powers shared work while a separate account powers personal sessions',
    },
    individual: {
      title: 'An account for each person',
      detail: 'Each teammate chooses their provider sign-in or API key.',
      label: 'Separate supplies give each teammate their own model and account',
    },
  }[mode];
  return (
    <section aria-label="Model setup preview" className="relative h-full">
      <div className="absolute inset-x-8 top-3">
        <Txt variant="caption" tone="muted">
          {copy.title}
        </Txt>
      </div>
      <OnboardingAccountLabels mode={mode} />
      <OnboardingSessionLabels individual={mode === 'individual'} />
      <div className="onboarding-scene-detail absolute inset-x-7 top-[89%]" style={{ animationDelay: '160ms' }}>
        <Txt variant="caption">{mode === 'individual' ? 'Your model. Their model.' : 'A shared starting point'}</Txt>
        <Txt variant="meta" tone="muted" className="mt-2 max-w-100">
          {copy.detail}
        </Txt>
      </div>
    </section>
  );
}
