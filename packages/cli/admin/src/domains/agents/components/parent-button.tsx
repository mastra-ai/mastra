import { forwardRef } from 'react';

import { Icon } from '@/components/icon';
import { iconArr } from '@/components/ui/svg/iconArr';

import { cn } from '@/lib/utils';

import { IconName } from '@/types/icons';

export const ParentButton = forwardRef<
  HTMLButtonElement,
  React.HTMLAttributes<HTMLButtonElement> & { parentIntegration: Array<{ name: string; value: string; icon: string }> }
>((props, ref) => {
  const { parentIntegration, ...rest } = props;
  return (
    <button type="button" ref={ref} {...rest} className="relative  overflow-x-scroll flex grow">
      <div className="z-10 flex grow gap-x-2.5">
        <div className="group/cell flex h-full shadow-lg max-h-[40px] min-h-[40px] grow transition-all">
          <span className="-mr-0.5 h-full max-h-[40px] min-h-[40px] w-3 origin-top-right rounded-l-[6px] border-transparent bg-mastra-bg-4 bg-clip-padding transition-all"></span>
          <div className="flex h-full max-h-[40px] min-h-[40px] grow items-center justify-between truncate bg-mastra-bg-4 bg-clip-padding text-white transition-colors">
            <div className="z-10 w-full">
              <span className="flex w-full items-center justify-between px-0 transition-all">
                <span className="text-sm flex items-center gap-2 capitalize">
                  {parentIntegration.length ? (
                    <>
                      {iconArr.includes(parentIntegration[0]?.icon) ? (
                        <Icon name={parentIntegration[0]?.icon as IconName} className=" text-mastra-el-3" />
                      ) : (
                        <Icon name={'system'} className=" text-mastra-el-3" />
                      )}
                      <span>
                        <span className="text-xs rounded-full px-2 py-1 bg-mastra-bg-9">
                          {parentIntegration[0]?.value}
                        </span>{' '}
                        <span
                          className={cn(
                            parentIntegration.length > 1
                              ? 'text-xs italic text-mastra-el-3 rounded-full px-2 py-1 bg-mastra-bg-9'
                              : '',
                          )}
                        >
                          {parentIntegration.length > 1 ? `+ ${parentIntegration.length - 1}` : ''}
                        </span>
                      </span>
                    </>
                  ) : (
                    <>
                      <Icon name="blocks" className=" text-mastra-el-3" />
                      <span>Add integration</span>
                    </>
                  )}
                  <br />
                </span>
              </span>
            </div>
          </div>
          <span className="h-full max-h-[40px] min-h-[40px] w-6 origin-top-right -skew-x-[21deg] rounded-br-[4px] rounded-tr-[10px] border-transparent bg-mastra-bg-4 bg-clip-padding transition-all"></span>
        </div>
      </div>
    </button>
  );
});

ParentButton.displayName = 'ParentButton';
