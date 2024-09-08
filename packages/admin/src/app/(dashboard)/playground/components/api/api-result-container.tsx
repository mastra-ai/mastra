'use client';

import { useActionPlaygroundContext } from '@/domains/playground/providers/action-playground-provider';

export function ApiResultContainer() {
  const { apiRunState } = useActionPlaygroundContext();
  return (
    <div
      id="api-result-container"
      className="flex-1 relative z-20 border-[0.5px] border-arkw-border-1 rounded-[0.25rem] bg-arkw-bg-2"
    >
      <div className="absolute text-sm rounded-tl-[0.25rem] grid place-items-center rounded-tr-[0.25rem] top-0 w-full text-center text-arkw-el-3 bg-arkw-bg-13 h-10 py-1 px-4">
        This is the Output
      </div>
      <div className="p-2">
        {apiRunState === 'success' ? (
          <p>Api Run Successfully</p>
        ) : apiRunState === 'fail' ? (
          <p>Api failed to run</p>
        ) : null}
      </div>
    </div>
  );
}
