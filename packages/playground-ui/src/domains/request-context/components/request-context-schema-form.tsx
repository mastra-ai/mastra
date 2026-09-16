import { useState } from 'react';

import { useRequestContext } from '../context/request-context-provider';
import { useRequestContextSchemaFormRenderer } from '../context/schema-form-renderer';
import { RequestContextLabel } from './request-context-label';
import { CopyButton } from '@/ds/components/CopyButton';
import { Txt } from '@/ds/components/Txt';

export interface RequestContextSchemaFormProps {
  /** Serialized JSON schema for request context validation. */
  requestContextSchema: string;
  labelTooltip?: string;
}

/**
 * Schema-driven form for the current entity request context. Edits are kept as a
 * draft and persisted by the surrounding run options "Save" button.
 * Requires a `RequestContextSchemaFormRendererProvider` up the tree.
 */
export const RequestContextSchemaForm = ({ labelTooltip, requestContextSchema }: RequestContextSchemaFormProps) => {
  const { setRequestContext, requestContext } = useRequestContext();
  const render = useRequestContextSchemaFormRenderer();
  const [draft, setDraft] = useState<Record<string, unknown>>();

  const values = draft ?? requestContext;

  if (!render) {
    return (
      <div className="text-neutral3">
        <Txt variant="ui-sm">No request context form renderer configured</Txt>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <RequestContextLabel tooltip={labelTooltip}>Request Context</RequestContextLabel>
        <CopyButton content={JSON.stringify(values)} />
      </div>

      {render({
        requestContextSchema,
        defaultValues: requestContext,
        onValuesChange: setDraft,
        onSave: values => {
          setRequestContext(values);
          setDraft(undefined);
        },
      })}
    </div>
  );
};
