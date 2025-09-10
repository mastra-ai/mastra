import { Wand2, Loader, CheckIcon, X, FileClock } from 'lucide-react';

import { Icon } from '@mastra/playground-ui';
import { CodeDisplay } from '@/components/ui/code-display';

import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { Txt } from '@mastra/playground-ui';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import clsx from 'clsx';

interface CurrentInstructionsProps {
  instructions?: string;
  enhancedPrompt: string;
  isEnhancing: boolean;
  userComment: string;
  onEnhance: () => void;
  onCancel: () => void;
  onSave: () => void;
  onCommentChange: (comment: string) => void;
  agentId: string;
  onShowHistory: () => void;
}

export function CurrentInstructions({
  instructions,
  enhancedPrompt,
  isEnhancing,
  userComment,
  onEnhance,
  onCancel,
  onSave,
  onCommentChange,
  onShowHistory,
}: CurrentInstructionsProps) {
  const currentContent = enhancedPrompt || instructions?.trim();

  const { isCopied, handleCopy } = useCopyToClipboard({ text: currentContent || '' });

  return (
    <div>
      <div className="flex items-center gap-4 pb-2">
        {enhancedPrompt ? (
          <div className="flex items-center gap-4">
            <button onClick={onCancel}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Icon className="hover:bg-surface2 rounded-lg">
                    <X className="text-accent2" />
                  </Icon>
                </TooltipTrigger>
                <TooltipContent>Discard prompt suggestions</TooltipContent>
              </Tooltip>
            </button>

            <button onClick={onSave} disabled={!enhancedPrompt}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Icon className="hover:bg-surface2 rounded-lg">
                    <CheckIcon className="text-accent1" />
                  </Icon>
                </TooltipTrigger>
                <TooltipContent>Save prompt suggestions</TooltipContent>
              </Tooltip>
            </button>
          </div>
        ) : (
          <button onClick={onShowHistory}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Icon className="hover:bg-surface2 rounded-lg text-icon3 hover:text-icon6">
                  <FileClock />
                </Icon>
              </TooltipTrigger>
              <TooltipContent>Version history</TooltipContent>
            </Tooltip>
          </button>
        )}
      </div>

      <div>
        <div className={clsx('p-[1px] rounded-lg overflow-hidden relative')}>
          <div
            className={clsx(
              'absolute inset-0 bg-surface4 transition-all',
              enhancedPrompt && 'bg-gradient-to-br from-accent1 to-accent3',
            )}
          />

          <div className="relative z-10 bg-surface4 rounded-lg">
            <CodeDisplay
              content={currentContent || ''}
              isCopied={isCopied}
              isDraft={!!enhancedPrompt}
              onCopy={() => currentContent && handleCopy()}
              className="border-none bg-surface4 text-ui-sm p-2 !h-[260px]"
            />

            <div className="px-3 py-3">
              <div className="flex justify-between rounded-lg border border-border1 bg-surface5 shadow-lg disabled:bg-surface3 text-icon6 w-full py-2 px-3 gap-3 relative z-10">
                <textarea
                  value={userComment}
                  onChange={e => onCommentChange(e.target.value)}
                  placeholder="Add your comments or requirements for enhancing your agent's prompt..."
                  className="resize-none text-ui-sm w-full placeholder:text-icon3 bg-transparent block disabled:text-icon3"
                  disabled={Boolean(isEnhancing || enhancedPrompt)}
                />

                <button onClick={onEnhance} disabled={isEnhancing || !instructions || Boolean(enhancedPrompt)}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Icon className="text-icon3 hover:text-icon6 disabled:hover:text-icon3">
                        {isEnhancing ? <Loader className="animate-spin" /> : <Wand2 />}
                      </Icon>
                    </TooltipTrigger>
                    <TooltipContent>{isEnhancing ? 'Enhancing...' : 'Enhance prompt'}</TooltipContent>
                  </Tooltip>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
