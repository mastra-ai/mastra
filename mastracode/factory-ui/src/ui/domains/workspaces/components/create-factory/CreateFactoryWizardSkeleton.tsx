import { SkeletonText } from '@mastra/playground-ui/components/Skeleton';

import { PaletteRowsSkeleton } from '../../../../ui/PaletteRowsSkeleton';
import { CreateFactoryInput, CreateFactoryPaletteLayout, CreateFactoryStepBars } from './CreateFactoryPalette';

export function CreateFactoryWizardSkeleton({ label }: { label: string }) {
  return (
    <CreateFactoryPaletteLayout
      label={label}
      titleRow={
        <>
          <span aria-hidden className="min-w-0 flex-1">
            <SkeletonText line="text-body" className="w-48 max-w-full motion-reduce:before:animate-none" />
          </span>
          <span aria-hidden className="contents">
            <CreateFactoryStepBars />
          </span>
        </>
      }
      input={
        <div inert className="contents">
          <CreateFactoryInput searchable={false} />
        </div>
      }
    >
      <PaletteRowsSkeleton label={label} />
    </CreateFactoryPaletteLayout>
  );
}
