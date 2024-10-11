import { forwardRef } from 'react';

import { cn } from '@/lib/utils';

export const ChildButton = forwardRef<
  HTMLButtonElement,
  React.HTMLAttributes<HTMLButtonElement> & { childApi: Array<{ name: string; value: string }> }
>((props, ref) => {
  const { childApi, ...rest } = props;
  return (
    <button
      type="button"
      ref={ref}
      {...rest}
      className="group/cell w-full max shadow-lg -ml-1 flex h-full max-h-[40px] min-h-[40px] grow  transition-all"
    >
      <span className="-mr-4 h-full max-h-[40px] min-h-[40px] w-6 origin-top-right -skew-x-[21deg] rounded-bl-[10px] rounded-tl-[4px] border-transparent bg-mastra-bg-4 bg-clip-padding transition-all"></span>
      <div className="flex h-full max-h-[40px] min-h-[40px] grow items-center justify-between truncate bg-mastra-bg-4 bg-clip-padding text-white transition-colors">
        <div className="z-10 w-full">
          <span className="flex items-center  px-0 text-sm transition-all">
            {childApi.length ? (
              <span>
                <span className="text-xs rounded-full px-2 py-1 bg-mastra-bg-9">{childApi[0]?.name}</span>{' '}
                <span
                  className={cn(
                    childApi.length > 1 ? 'text-xs italic text-mastra-el-3 rounded-full px-2 py-1 bg-mastra-bg-9' : '',
                  )}
                >
                  {childApi.length > 1 ? `+ ${childApi.length - 1}` : ''}
                </span>
              </span>
            ) : (
              <span className="text-mastra-el-3">Add api</span>
            )}
          </span>
        </div>
      </div>
      <span className="-ml-0.5 h-full max-h-[40px] min-h-[40px] w-3 origin-top-right rounded-r-[6px] border-transparent bg-mastra-bg-4 bg-clip-padding transition-all"></span>
    </button>
  );
});

ChildButton.displayName = 'ChildButton';
