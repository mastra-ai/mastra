'use client';

import { CodeBlockDemo } from '@/app/components/code-block';
import { useActionPlaygroundContext } from '@/domains/playground/providers/action-playground-provider';

export function ApiResultContainer() {
  const { apiRunState, apiResult } = useActionPlaygroundContext();

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
