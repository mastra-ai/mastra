import { Separator } from '@radix-ui/react-dropdown-menu';

import { ApiCodeBlock } from '@/domains/playground/components/api/api-code-block';
import { ApiResultContainer } from '@/domains/playground/components/api/api-result-container';
import { ApiSchemaBlock } from '@/domains/playground/components/api/api-schema-block';
import { RunButtonContainer } from '@/domains/playground/components/api/run-button-container';

export default function Page({
  params,
  searchParams,
}: {
  params: { api: Array<string> };
  searchParams: { name: string };
}) {
  return (
    <div className="grid h-[calc(100%-1.24rem)] gap-x-[0.62rem] grid-cols-[23.5rem_0.5px_1fr]">
      <ApiSchemaBlock type={searchParams.name.toUpperCase()} />
      <Separator className="w-[0.5px] bg-kpl-border-1" />
      <div className="flex flex-col gap-5 rounded-[0.375rem]">
        <div className="basis-[27rem] grow-0 relative z-20 border-[0.5px] border-kpl-border-1 rounded-[0.25rem] bg-kpl-bg-2">
          <ApiCodeBlock />
          <div className="absolute left-0 text-sm rounded-bl-[0.25rem] grid place-items-center rounded-br-[0.25rem] bottom-0 w-full text-center text-kpl-el-3 bg-kpl-bg-13 h-10 py-1 px-4">
            Code block to use in your app
          </div>
        </div>
        <RunButtonContainer />
        <div
          id="api-result-container"
          className="relative flex-1 z-20 border-[0.5px] border-kpl-border-1 rounded-[0.25rem] bg-kpl-bg-2"
        >
          <div className="absolute flex justify-between items-center text-sm rounded-tl-[0.25rem] rounded-tr-[0.25rem] top-0 w-full text-center text-kpl-el-3 bg-kpl-bg-13 h-10 py-1 px-4">
            <p className="text-sm">Output</p>
            <p className="text-xs border border-kpl-border-1 p-1 rounded bg-kpl-bg-8 font-medium">JSON</p>
          </div>
          <ApiResultContainer />
        </div>
      </div>
    </div>
  );
}
