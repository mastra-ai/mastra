'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { snakeCase } from 'lodash';
import { forwardRef, useState } from 'react';

import { Label } from '@/components/ui/label';
import SelectDropDown from '@/components/ui/select-dropdown';
import { iconArr } from '@/components/ui/svg/iconArr';

import { capitalizeFirstLetter } from '@/lib/string';
import { cn } from '@/lib/utils';

import { Icon } from '@/app/components/icon';
import { getParsedFrameworkApis } from '@/domains/workflows/utils';
import { IconName } from '@/types/icons';

import { useAgentFormContext } from '../context/agent-form-context';

interface ToolsMultiSelectProps {
  data: string;
}

export const ToolsMultiSelect = ({ data }: ToolsMultiSelectProps) => {
  const [parentIntegration, setParentIntegration] = useState(
    [] as Array<{ name: string; value: string; icon: string }>,
  );
  const [childApi, setChildApi] = useState([] as Array<{ name: string; value: string; parent: string }>);
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

  const apiArr = [] as Array<{ name: string; value: string; parent: string }>;
  parentIntegration.forEach(item => {
    //get the api for the integration
    const apisForIntegration = desrializedData
      .map(data => {
        if (data.integrationName === item.value) {
          {
            return data;
          }
        }
      })
      .filter(val => val !== undefined)
      .map(item => ({ name: snakeCase(item.label), value: item.label, parent: item.integrationName }));

    apiArr.push(...apisForIntegration);
  });

  const { setTools } = useAgentFormContext();

  return (
    <div className="space-y-3">
      <Label className="text-mastra-el-3">Select Integration and related Api(s) for the agent:</Label>
      <AnimatePresence>
        <div className="flex gap-2 p-1 rounded">
          <SelectDropDown<{ name: string; value: string; icon: string }>
            idKey="value"
            data={integrationKeys}
            selectedValues={parentIntegration}
            setSelectedValues={setParentIntegration}
            placeholder="Select System or integration"
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

          {parentIntegration.length ? (
            <motion.div
              animate={{
                width: parentIntegration.length ? '206px' : 0,
              }}
              exit={{ width: 0 }}
              className="max-w-[206px]"
            >
              <SelectDropDown<{ name: string; value: string; parent: string }>
                idKey="value"
                data={apiArr}
                selectedValues={childApi}
                setSelectedValues={setChildApi}
                placeholder="Select Api"
                open={openChild}
                onOpenChange={setOpenChild}
                groupKey="parent"
                groupOptions
                onSelectItem={item => {
                  setTools(tools => ({
                    ...tools,
                    [item.name]: true,
                  }));
                }}
                onDeselectItem={item => {
                  setTools(tools => {
                    if (Object.keys(tools).includes(item.name)) {
                      delete tools[item.name];
                      return tools;
                    }
                    return tools;
                  });
                }}
              >
                <ChildButton childApi={childApi} onClick={() => setOpenChild(prev => !prev)} />
              </SelectDropDown>
            </motion.div>
          ) : null}
        </div>
      </AnimatePresence>
    </div>
  );
};

const ParentButton = forwardRef<
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
ParentButton.displayName = 'ParentButton';

export default ToolsMultiSelect;
