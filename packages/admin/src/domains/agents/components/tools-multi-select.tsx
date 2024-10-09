'use client';

import { forwardRef, useState } from 'react';

import { Label } from '@/components/ui/label';
import SelectDropDown from '@/components/ui/select-dropdown';
import { iconArr } from '@/components/ui/svg/iconArr';

import { capitalizeFirstLetter } from '@/lib/string';

import { Icon } from '@/app/components/icon';
import { getParsedFrameworkApis } from '@/domains/workflows/utils';
import { IconName } from '@/types/icons';

interface ToolsMultiSelectProps {
  data: string;
}

export const ToolsMultiSelect = ({ data }: ToolsMultiSelectProps) => {
  const [parentIntegration, setParentIntegration] = useState(
    [] as Array<{ name: string; value: string; icon: string }>,
  );
  const [childApi, setChildApi] = useState([] as Array<{ name: string; value: string }>);
  const [openParent, setOpenParent] = useState(false);
  const [openChild, setOpenChild] = useState(false);

  const desrializedData = getParsedFrameworkApis(data);

  const groupedData = desrializedData.reduce((acc: Record<string, any>, curr) => {
    if (!acc[curr.integrationName]) {
      acc[curr.integrationName] = [];
    }
    acc[curr.integrationName].push(curr);
    return acc;
  }, {});

  const integrationKeys = Object.keys(groupedData).map(key => ({
    name: capitalizeFirstLetter(key),
    value: key,
    icon: key.toLowerCase(),
  }));

  const apis = desrializedData
    .map(data => {
      if (data.integrationName === parentIntegration[0]?.value) {
        {
          return data;
        }
      }
    })
    .filter(val => val !== undefined)
    .map(item => ({ name: item.label, value: item.label }));

  return (
    <div className="space-y-3">
      <Label className="text-mastra-el-3">Select Integration and related Api(s) for the agent:</Label>
      <div className="w-80 flex gap-2 border border-mastra-border-1 p-1 rounded">
        <SelectDropDown<{ name: string; value: string; icon: string }>
          idKey="value"
          data={integrationKeys}
          selectedValues={parentIntegration}
          setSelectedValues={setParentIntegration}
          placeholder="Select System or integration"
          onSelectItem={val => {
            const newData = desrializedData
              .map(data => {
                if (data.integrationName === val?.value) {
                  {
                    return data;
                  }
                }
              })
              .filter(val => val !== undefined)
              .map(item => ({ name: item.label, value: item.label }));

            setChildApi(newData);
          }}
          isSingleSelect
          withCheckbox={false}
          open={openParent}
          onOpenChange={setOpenParent}
          iconRenderProp={item => {
            if (!iconArr.includes(item.icon)) {
              return <Icon name="system" />;
            }
            return <Icon name={item.icon as IconName} />;
          }}
        >
          <ParentButton parentIntegration={parentIntegration} onClick={() => setOpenParent(prev => !prev)} />
        </SelectDropDown>

        <SelectDropDown<{ name: string; value: string }>
          idKey="value"
          data={apis}
          selectedValues={childApi}
          setSelectedValues={setChildApi}
          placeholder="Select Api"
          isSingleSelect
          withCheckbox={false}
          open={openChild}
          onOpenChange={setOpenChild}
        >
          <ChildButton childApi={childApi} onClick={() => setOpenChild(prev => !prev)} />
        </SelectDropDown>
      </div>
    </div>
  );
};

const ParentButton = forwardRef<
  HTMLButtonElement,
  React.HTMLAttributes<HTMLButtonElement> & { parentIntegration: Array<{ name: string; value: string; icon: string }> }
>((props, ref) => {
  const { parentIntegration, ...rest } = props;
  return (
    <button type="button" ref={ref} {...rest} className="relative flex grow">
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
                      <span> {parentIntegration[0]?.name}</span>
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

const ChildButton = forwardRef<
  HTMLButtonElement,
  React.HTMLAttributes<HTMLButtonElement> & { childApi: Array<{ name: string; value: string }> }
>((props, ref) => {
  const { childApi, ...rest } = props;
  return (
    <button
      type="button"
      ref={ref}
      {...rest}
      className="group/cell shadow-lg -ml-1 flex h-full max-h-[40px] min-h-[40px] grow  transition-all"
    >
      <span className="-mr-4 h-full max-h-[40px] min-h-[40px] w-6 origin-top-right -skew-x-[21deg] rounded-bl-[10px] rounded-tl-[4px] border-transparent bg-mastra-bg-4 bg-clip-padding transition-all"></span>
      <div className="flex h-full max-h-[40px] min-h-[40px] grow items-center justify-between truncate bg-mastra-bg-4 bg-clip-padding text-white transition-colors">
        <div className="z-10 w-full">
          <span className="flex items-center px-0 text-sm transition-all">
            {childApi.length ? childApi[0]?.name : 'Add api'}
          </span>
        </div>
      </div>
      <span className="-ml-0.5 h-full max-h-[40px] min-h-[40px] w-3 origin-top-right rounded-r-[6px] border-transparent bg-mastra-bg-4 bg-clip-padding transition-all"></span>
    </button>
  );
});

ChildButton.displayName = 'ChildButton';
ParentButton.displayName = 'ParentButton';

export default ToolsMultiSelect;
