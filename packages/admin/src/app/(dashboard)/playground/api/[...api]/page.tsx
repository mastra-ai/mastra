import { Separator } from '@radix-ui/react-dropdown-menu';

import { ApiCodeBlock } from '@/domains/playground/components/api-code-block';

import { ApiResultContainer } from '../../components/api/api-result-container';
import { ApiSchemaBlock } from '../../components/api/api-schema-block';
import { RunButtonContainer } from '../../components/api/run-button-container';

export default function Page({ params }: { params: { api: Array<string> } }) {
  const [_, api] = params.api;

  return (
    <div className="grid h-[calc(100%-1.24rem)] gap-x-[0.62rem] grid-cols-[23.5rem_0.5px_1fr]">
      <ApiSchemaBlock type={api.toUpperCase()} />
      <Separator className="w-[0.5px] bg-kpl-border-1" />
      <div className="flex flex-col gap-5 rounded-[0.375rem]">
        <div className="basis-[27rem] grow-0 relative z-20 border-[0.5px] border-kpl-border-1 rounded-[0.25rem] bg-kpl-bg-2">
          <ApiCodeBlock />
          <div className="absolute left-0 text-sm rounded-bl-[0.25rem] grid place-items-center rounded-br-[0.25rem] bottom-0 w-full text-center text-kpl-el-3 bg-kpl-bg-13 h-10 py-1 px-4">
            Code block to use in your app
          </div>
        </div>
        <RunButtonContainer />
        <ApiResultContainer />
      </div>
    </div>
  );
}
