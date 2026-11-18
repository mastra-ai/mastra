import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { cn } from '@mastra/playground-ui/utils/cn';

import { PaletteRowsSkeleton } from '../../../../ui/PaletteRowsSkeleton';
import { CREATE_FACTORY_STEPS } from '../../hooks/useCreateFactoryFlow';
import {
  CREATE_FACTORY_INPUT,
  CREATE_FACTORY_PALETTE,
  CREATE_FACTORY_STEP_BAR,
  CREATE_FACTORY_STEP_BARS,
  CREATE_FACTORY_TITLE_ROW,
  CREATE_FACTORY_WIZARD,
  CreateFactoryPaletteKeys,
} from './CreateFactoryPalette';

export function CreateFactoryWizardSkeleton({ label }: { label: string }) {
  return (
    <div className={CREATE_FACTORY_WIZARD}>
      <div className={CREATE_FACTORY_PALETTE}>
        <div aria-hidden className={CREATE_FACTORY_TITLE_ROW}>
          <span className="min-w-0 flex-1">
            <SkeletonText line="text-body" className="w-48 max-w-full motion-reduce:before:animate-none" />
          </span>
          <span className={CREATE_FACTORY_STEP_BARS}>
            {CREATE_FACTORY_STEPS.map(step => (
              <span key={step} className={cn(CREATE_FACTORY_STEP_BAR, 'bg-fill')} />
            ))}
          </span>
        </div>
        <Skeleton
          aria-hidden
          className={cn(CREATE_FACTORY_INPUT, 'w-full shrink-0 rounded-xl motion-reduce:before:animate-none')}
        />
        <div aria-hidden>
          <CreateFactoryPaletteKeys />
        </div>
        <PaletteRowsSkeleton label={label} />
      </div>
    </div>
  );
}
