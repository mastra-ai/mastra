import { PaletteRowsSkeleton } from '../../../../ui/PaletteRowsSkeleton';
import { useCreateFactoryFlow } from '../../hooks/useCreateFactoryFlow';
import { CreateFactoryNameRows } from './CreateFactoryNameRows';
import { CreateFactoryPalette } from './CreateFactoryPalette';

export function CreateFactoryWizardSkeleton({ label }: { label: string }) {
  const flow = useCreateFactoryFlow();
  const { step } = flow.draft;
  return (
    <div role="status" aria-label={label} className="contents">
      <div inert className="contents">
        <CreateFactoryPalette
          step={step}
          value={flow.stepValue}
          onValueChange={() => undefined}
          onBack={flow.canGoBack ? () => undefined : undefined}
          onSkip={() => undefined}
        >
          {step === 'name' ? (
            <CreateFactoryNameRows name={flow.stepValue} onSubmit={() => undefined} />
          ) : (
            <PaletteRowsSkeleton label={label} />
          )}
        </CreateFactoryPalette>
      </div>
    </div>
  );
}
