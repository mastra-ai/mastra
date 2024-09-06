import { Separator } from '@radix-ui/react-dropdown-menu';

import { ApiCodeBlock } from '@/domains/playground/components/api-code-block';

import { ApiSchemaBlock } from '../../components/api/api-schema-block';
import { RunApiOrEvent } from '../../components/run-button';

export default function Page({ params }: { params: { api: Array<string> } }) {
  const [_, api] = params.api;
  // use the send_email to get the action detail from a list
  return (
    <div className="grid h-[calc(100%-1.24rem)] gap-x-[0.62rem] grid-cols-[23.5rem_0.5px_1fr]">
      <ApiSchemaBlock type={api.toUpperCase()} />
      <Separator className="w-[0.5px] bg-arkw-border-1" />
      <div className="flex flex-col gap-5 rounded-[0.375rem]">
        <div className="basis-[27rem] border-[0.5px] border-arkw-border-1 p-2 rounded-[0.25rem] bg-arkw-bg-2">
          <ApiCodeBlock />
        </div>
        <div className="p-2 rounded-xl mx-auto border-arkw-border-2 border-[0.5px] w-fit">
          <RunApiOrEvent context="api" />
        </div>
        <div className="flex-1 p-2  border-[0.5px] border-arkw-border-1 rounded-[0.25rem] bg-arkw-bg-2">
          another stuff
        </div>
      </div>
    </div>
  );
}
