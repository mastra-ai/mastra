'use client';

import { useEffect } from 'react';

import DynamicForm from '@/domains/playground/components/api-dynamic-form';
import { useActionPlaygroundContext } from '@/domains/playground/providers/action-playground-provider';

function ApiSchemaBlock({ type }: { type: string }) {
  const { frameworkActions, setSelectedAction } = useActionPlaygroundContext();

  const frameworkAction = frameworkActions.find(action => action.type.toLowerCase() === type.toLowerCase());
  console.log({ frameworkAction, type, frameworkActions });

  useEffect(() => {
    setSelectedAction(frameworkAction);
  }, [frameworkAction]);

  return (
    <div className="border-[0.5px] rounded-[0.375rem] bg-kpl-bg-2 border-kpl-border-1 overflow-hidden">
      <DynamicForm showChangeButton={false} headerClassname="p-4 bg-kpl-bg-13" />
    </div>
  );
}

export { ApiSchemaBlock };
