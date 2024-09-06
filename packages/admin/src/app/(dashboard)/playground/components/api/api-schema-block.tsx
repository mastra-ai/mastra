'use client';

import { useEffect } from 'react';

import DynamicForm from '@/domains/playground/components/api-dynamic-form';
import { useActionPlaygroundContext } from '@/domains/playground/providers/action-playground-provider';

function ApiSchemaBlock({ type }: { type: string }) {
  const { frameworkActions, setSelectedAction } = useActionPlaygroundContext();

  const frameworkAction = frameworkActions.find(action => action.type === type);

  useEffect(() => {
    setSelectedAction(frameworkAction);
  }, [frameworkAction]);

  return (
    <div className="border-[0.5px] rounded-[0.375rem] bg-arkw-bg-2 border-arkw-border-1">
      <DynamicForm showChangeButton={false} headerClassname="p-4 bg-arkw-bg-13" />
    </div>
  );
}

export { ApiSchemaBlock };
