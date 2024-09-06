'use client';

import { Separator } from '@radix-ui/react-dropdown-menu';

export default function Page({ params }: { params: { api: Array<string> } }) {
  const [integrationName, api] = params.api;
  return (
    <div className="grid h-[calc(100%-1.24rem)] gap-x-[0.62rem] grid-cols-[23.5rem_0.5px_1fr]">
      <div className="border-[0.5px] rounded-[0.375rem] bg-arkw-bg-2 border-arkw-border-1 p-2">some stuff</div>
      <Separator className="w-[0.5px] bg-arkw-border-1" />
      <div className="flex flex-col gap-5 rounded-[0.375rem]">
        <div className="basis-[27rem] border-[0.5px] border-arkw-border-1 p-2 rounded-[0.25rem] bg-arkw-bg-2">
          another stuff
        </div>
        <div className="p-2 rounded-xl mx-auto border-arkw-border-2 border-[0.5px] w-fit">
          <button
            onClick={() => alert('event ran')}
            className="bg-[#33616B]  border-[0.5px] border-[#5699A8] rounded text-sm font-medium text-arkw-el-5 w-[10.25rem] py-2 px-3"
          >
            Run event
          </button>
        </div>
        <div className="flex-1 p-2  border-[0.5px] border-arkw-border-1 rounded-[0.25rem] bg-arkw-bg-2">
          another stuff
        </div>
      </div>
    </div>
  );
}
