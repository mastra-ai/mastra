'use client';

import { CodeBlockDemo } from '@/app/components/code-block';
import { useActionPlaygroundContext } from '@/domains/playground/providers/action-playground-provider';

export function ApiResultContainer() {
  const { apiRunState, apiResult } = useActionPlaygroundContext();

  return (
    <div
      id="api-result-container"
      className="flex-1 relative z-20 border-[0.5px] border-kp-border-1 rounded-[0.25rem] bg-kp-bg-2"
    >
      <div className="absolute flex justify-between items-center text-sm rounded-tl-[0.25rem] rounded-tr-[0.25rem] top-0 w-full text-center text-kp-el-3 bg-kp-bg-13 h-10 py-1 px-4">
        <p className="text-sm">Output</p>
        <p className="text-xs border border-kp-border-1 p-1 rounded bg-kp-bg-8 font-medium">JSON</p>
      </div>
      <div className="p-2 pt-12">
        {apiRunState === 'success' ? (
          <CodeBlockDemo code={apiResult} />
        ) : apiRunState === 'fail' ? (
          <CodeBlockDemo code={apiResult} />
        ) : null}
      </div>
    </div>
  );
}
