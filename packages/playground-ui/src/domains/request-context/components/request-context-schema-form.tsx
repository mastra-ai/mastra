import { useEffect, useState, useMemo, useImperativeHandle, forwardRef } from 'react';
import { Icon } from '@/ds/icons/Icon';
import { Txt } from '@/ds/components/Txt';
import { usePlaygroundStore } from '@/store/playground-store';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { DynamicForm } from '@/lib/form';
import { resolveSerializedZodOutput } from '@/lib/form/utils';
import { jsonSchemaToZod } from '@mastra/schema-compat/json-to-zod';
import { parse } from 'superjson';
import { useSchemaRequestContext } from '../context/schema-request-context';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ds/components/Tooltip';
import { CopyIcon } from 'lucide-react';

export interface RequestContextSchemaFormRef {
  /** Get the current form values (for use when executing) */
  getValues: () => Record<string, any>;
}

export interface RequestContextSchemaFormProps {
  /**
   * Serialized JSON schema for request context validation.
   * This component should only be rendered when a schema is provided.
   */
  requestContextSchema: string;
}

/**
 * Component that displays a schema-driven form for request context.
 * Only rendered when an agent/workflow defines a requestContextSchema.
 *
 * This component syncs form values to the SchemaRequestContext on every change,
 * allowing the agent chat to use these values (which override global context).
 * Empty strings in form fields will override global values intentionally.
 */
export const RequestContextSchemaForm = forwardRef<RequestContextSchemaFormRef, RequestContextSchemaFormProps>(
  ({ requestContextSchema }, ref) => {
    const { requestContext } = usePlaygroundStore();
    const { setSchemaValues } = useSchemaRequestContext();
    // Local state for schema-driven form (does NOT update global store)
    const [localFormValues, setLocalFormValues] = useState<Record<string, any>>({});

    const localFormValuesStr = JSON.stringify(localFormValues);
    const { handleCopy } = useCopyToClipboard({ text: localFormValuesStr });

    // Parse the schema
    const zodSchema = useMemo(() => {
      try {
        const jsonSchema = parse(requestContextSchema) as Parameters<typeof jsonSchemaToZod>[0];
        return resolveSerializedZodOutput(jsonSchemaToZod(jsonSchema));
      } catch (error) {
        console.error('Failed to parse requestContextSchema:', error);
        return null;
      }
    }, [requestContextSchema]);

    // When global context changes, update local form values
    // Note: This syncs the form display but doesn't override schemaValues
    // (schemaValues are set via onValuesChange to ensure form values take precedence)
    useEffect(() => {
      if (zodSchema && requestContext) {
        setLocalFormValues(requestContext);
      }
    }, [zodSchema, requestContext]);

    // Expose getValues method to parent components via ref
    useImperativeHandle(ref, () => ({
      getValues: () => localFormValues,
    }));

    // Update local state and schema context on every form change
    // This ensures empty strings properly override global values
    const handleSchemaFormChange = (data: Record<string, any>) => {
      setLocalFormValues(data);
      setSchemaValues(data);
    };

    const buttonClass = 'text-neutral3 hover:text-neutral6';

    if (!zodSchema) {
      return (
        <div className="text-neutral3">
          <Txt variant="ui-sm">Failed to parse request context schema</Txt>
        </div>
      );
    }

    return (
      <TooltipProvider>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Txt as="label" variant="ui-md" className="text-neutral3">
              Request Context
            </Txt>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={handleCopy} className={buttonClass}>
                    <Icon>
                      <CopyIcon />
                    </Icon>
                  </button>
                </TooltipTrigger>
                <TooltipContent>Copy Request Context</TooltipContent>
              </Tooltip>
            </div>
          </div>

          <DynamicForm schema={zodSchema} onValuesChange={handleSchemaFormChange} defaultValues={requestContext} />
        </div>
      </TooltipProvider>
    );
  },
);
