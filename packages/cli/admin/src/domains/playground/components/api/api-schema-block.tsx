'use client';

import { useEffect } from 'react';

import DynamicForm from '@/domains/playground/components/api/api-dynamic-form';

import { useApiPlaygroundContext } from '../../context/api-playground-context';

function ApiSchemaBlock({ type }: { type: string }) {
  const { frameworkApis, setSelectedApi } = useApiPlaygroundContext();

  const frameworkApi = frameworkApis.find(action => action.type.toLowerCase() === type.toLowerCase());

  useEffect(() => {
    setSelectedApi(frameworkApi);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameworkApi]);

  return (
    <div className="border-[0.5px] rounded-[0.375rem] bg-mastra-bg-2 border-mastra-border-1 overflow-hidden">
      <DynamicForm showChangeButton={false} headerClassname="p-4 bg-mastra-bg-13" />
    </div>
  );
}

export { ApiSchemaBlock };
