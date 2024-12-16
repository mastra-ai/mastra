import { Separator } from '@radix-ui/react-dropdown-menu';
import { ResolvingMetadata, Metadata } from 'next';

import { toTitleCase } from '@/lib/string';

import { ApiCodeBlock } from '@/domains/playground/components/api/api-code-block';
import { ApiResultContainer } from '@/domains/playground/components/api/api-result-container';
import { ApiSchemaBlock } from '@/domains/playground/components/api/api-schema-block';
import { RunButtonContainer } from '@/domains/playground/components/api/run-button-container';

type Props = {
  params: Promise<{ api: Array<string> }>;
  searchParams: Promise<{ name: string }>;
};

export async function generateMetadata({ params, searchParams }: Props, parent: ResolvingMetadata): Promise<Metadata> {
  // read route params
  const name = toTitleCase((await searchParams).name, '_');

  return {
    title: `API - ${name || ''}`,
    description: `API  - ${name || ''}`,
  };
}

export default async function Page(props: {
  params: Promise<{ api: Array<string> }>;
  searchParams: Promise<{ name: string }>;
}) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  return (
    <div className="grid h-[calc(100%-1.24rem)] gap-x-[0.62rem] grid-cols-[23.5rem_0.5px_1fr]">
      <ApiSchemaBlock type={searchParams.name.toUpperCase()} />
      <Separator className="w-[0.5px] bg-mastra-border-1" />
      <div className="flex flex-col gap-5 rounded-[0.375rem]">
        <div className="basic-[24rem] grow-0 relative z-20 border-[0.5px] border-mastra-border-1 rounded-[0.25rem] bg-mastra-bg-2">
          <ApiCodeBlock />
          <div className="absolute left-0 text-sm rounded-bl-[0.25rem] grid place-items-center rounded-br-[0.25rem] bottom-0 w-full text-center text-mastra-el-3 bg-mastra-bg-13 h-10 py-1 px-4">
            Code block to use in your app
          </div>
        </div>
        <RunButtonContainer />
        <div
          id="api-result-container"
          className="relative flex-1 z-20 border-[0.5px] border-mastra-border-1 rounded-[0.25rem] bg-mastra-bg-2"
        >
          <div className="absolute flex justify-between items-center text-sm rounded-tl-[0.25rem] rounded-tr-[0.25rem] top-0 w-full text-center text-mastra-el-3 bg-mastra-bg-13 h-10 py-1 px-4">
            <p className="text-sm">Output</p>
            <p className="text-xs border border-mastra-border-1 p-1 rounded bg-mastra-bg-8 font-medium">JSON</p>
          </div>
          <ApiResultContainer />
        </div>
      </div>
    </div>
  );
}
