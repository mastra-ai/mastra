import { Composer as ComposerRoot, ComposerRing } from '@mastra/playground-ui/components/Composer';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';

import { Composer } from './Composer';
import { AttachImagesMenu, ComposerLayout, MessageInput } from './ComposerLayout';
import { ComposerSendButton } from './ComposerPrimaryAction';
import { ModelPickerLoading } from './StatusLine/ModelPicker';

import './chat-enter.css';

const composerPanelClass = 'flex min-w-0 w-full max-w-full shrink-0 flex-col gap-1.5';

type ComposerPanelProps = {
  composerVariant?: 'inline' | 'textarea';
  statusLead?: ReactNode;
};

export function ComposerPanel({ composerVariant = 'inline', statusLead }: ComposerPanelProps) {
  return (
    <div className={cn('composer-enter', composerPanelClass)}>
      <Composer variant={composerVariant} statusLead={statusLead} />
    </div>
  );
}

export function ComposerPanelLoading() {
  return (
    <div className={composerPanelClass}>
      <ComposerRoot inert>
        <ComposerRing>
          <ComposerLayout
            input={<MessageInput />}
            attach={<AttachImagesMenu />}
            actions={
              <>
                <ModelPickerLoading />
                <Skeleton aria-hidden className="size-control-sm rounded-full motion-reduce:before:animate-none" />
                <ComposerSendButton disabled />
              </>
            }
          />
        </ComposerRing>
      </ComposerRoot>
    </div>
  );
}
