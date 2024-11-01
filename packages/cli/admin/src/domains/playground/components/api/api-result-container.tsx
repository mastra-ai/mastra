'use client';

import { CodeBlockDemo } from '@/components/code-block';

import { useApiPlaygroundContext } from '../../context/api-playground-context';

export function ApiResultContainer() {
  const { apiRunState, apiResult } = useApiPlaygroundContext();

  return (
    <div className="p-2 pt-12 max-h-[23rem] overflow-scroll">
      {apiRunState === 'success' ? (
        <CodeBlockDemo code={apiResult} language="json" />
      ) : (
        <CodeBlockDemo code={apiResult} language="json" />
      )}
    </div>
  );
}
