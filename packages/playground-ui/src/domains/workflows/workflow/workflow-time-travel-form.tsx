import { useContext, useEffect, useMemo, useState, FormEvent } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { jsonLanguage } from '@codemirror/lang-json';
import { useCodemirrorTheme } from '@/components/syntax-highlighter';
import { WorkflowInputData } from './workflow-input-data';
import { WorkflowRunContext } from '../context/workflow-run-context';
import { Button } from '@/ds/components/Button';
import { Txt } from '@/ds/components/Txt';
import { Icon } from '@/ds/icons';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Braces, ChevronDown, CopyIcon, Loader2 } from 'lucide-react';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { formatJSON, isValidJson } from '@/lib/formatting';
import jsonSchemaToZod from 'json-schema-to-zod';
import { parse } from 'superjson';
import { resolveSerializedZodOutput } from '@/components/dynamic-form/utils';
import { z } from 'zod';
import { constructNestedStepContext } from '../utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { usePlaygroundStore } from '@/store/playground-store';

const buttonClass = 'text-icon3 hover:text-icon6';

export type WorkflowTimeTravelFormProps = {
  stepKey: string;
  closeModal: () => void;
};

const prettyJson = (value: unknown) => {
  try {
    if (value === undefined || value === null) {
      return '{}';
    }
    return JSON.stringify(value, null, 2);
  } catch {
    return '{}';
  }
};

const JsonField = ({
  label,
  value,
  onChange,
  helperText,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  helperText?: string;
}) => {
  const theme = useCodemirrorTheme();
  const { handleCopy } = useCopyToClipboard({ text: value });
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleFormat = async () => {
    setFieldError(null);
    if (!value.trim()) {
      onChange('{}');
      return;
    }
    if (!isValidJson(value)) {
      setFieldError('Invalid JSON');
      return;
    }

    try {
      const formatted = await formatJSON(value);
      onChange(formatted);
    } catch {
      setFieldError('Unable to format JSON');
    }
  };

  return (
    <Collapsible className="border border-border1 rounded-lg bg-surface3" open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center justify-between w-full px-3">
          <div>
            <Txt as="label" variant="ui-md" className="text-icon3">
              {label}
            </Txt>
            {helperText && (
              <Txt variant="ui-xs" className="text-icon3">
                {helperText}
              </Txt>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" onClick={handleFormat} className={buttonClass} aria-label="Format JSON">
                  <Icon>
                    <Braces />
                  </Icon>
                </button>
              </TooltipTrigger>
              <TooltipContent>Format JSON</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" onClick={handleCopy} className={buttonClass} aria-label="Copy JSON">
                  <Icon>
                    <CopyIcon />
                  </Icon>
                </button>
              </TooltipTrigger>
              <TooltipContent>Copy JSON</TooltipContent>
            </Tooltip>
            <Icon className={cn('transition-transform', isOpen ? 'rotate-0' : '-rotate-90')}>
              <ChevronDown />
            </Icon>
          </div>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-2">
        <CodeMirror
          value={value}
          onChange={onChange}
          theme={theme}
          extensions={[jsonLanguage]}
          className="h-[260px] overflow-y-scroll bg-surface3 rounded-lg overflow-hidden p-3"
        />

        {fieldError && (
          <Txt variant="ui-sm" className="text-accent2">
            {fieldError}
          </Txt>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

export const WorkflowTimeTravelForm = ({ stepKey, closeModal }: WorkflowTimeTravelFormProps) => {
  const {
    result,
    workflow,
    timeTravelWorkflowStream,
    createWorkflowRun,
    runId: prevRunId,
    workflowId,
  } = useContext(WorkflowRunContext);
  const { requestContext } = usePlaygroundStore();
  const stepResult = result?.steps?.[stepKey];
  const [resumeData, setResumeData] = useState(() => {
    if (stepResult && 'resumePayload' in stepResult) {
      return prettyJson(stepResult.resumePayload);
    }
    return prettyJson({});
  });
  const [contextValue, setContextValue] = useState(() => '{}');
  const [nestedContextValue, setNestedContextValue] = useState(() => '{}');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const stepDefinition = workflow?.allSteps?.[stepKey];

  const { schema: stepSchema, schemaError } = useMemo(() => {
    if (!stepDefinition?.inputSchema) {
      return { schema: z.record(z.string(), z.any()), schemaError: 'Step schema not available' };
    }

    try {
      const parsed = parse(stepDefinition.inputSchema);
      return { schema: resolveSerializedZodOutput(jsonSchemaToZod(parsed as any)), schemaError: null };
    } catch (err) {
      console.error('Failed to parse step schema', err);
      return { schema: z.record(z.string(), z.any()), schemaError: 'Unable to read step schema' };
    }
  }, [stepDefinition?.inputSchema]);

  const resumePayload = stepResult && 'resumePayload' in stepResult ? stepResult.resumePayload : undefined;

  useEffect(() => {
    setResumeData(prettyJson(resumePayload ?? {}));
  }, [resumePayload]);

  useEffect(() => {
    if (result?.steps) {
      let newStepResult: Record<string, any> = {};
      for (const stepId of Object.keys(result.steps)) {
        if (stepId === stepKey) {
          break;
        }
        newStepResult[stepId] = result.steps[stepId];
      }
      const stepEntries = Object.entries(newStepResult ?? {});
      const contextEntries = stepEntries.filter(([key]) => !key.includes('.'));
      const nestedEntries = stepEntries.filter(([key]) => key.includes('.'));
      setContextValue(prettyJson(Object.fromEntries(contextEntries)));
      const nestedStepContext = constructNestedStepContext(Object.fromEntries(nestedEntries));
      setNestedContextValue(prettyJson(nestedStepContext));
    }
  }, [result?.steps, stepKey]);

  const ensureNestedPath = (root: Record<string, any>, path: string[]) => {
    let cursor = root;
    for (const segment of path) {
      if (!cursor[segment] || typeof cursor[segment] !== 'object') {
        cursor[segment] = {};
      }
      cursor = cursor[segment];
    }
    return cursor;
  };

  const handleSubmit = async (data: Record<string, any>) => {
    setFormError(null);
    setIsSubmitting(true);

    try {
      const parsedResume = resumeData.trim() ? JSON.parse(resumeData) : {};
      const parsedContext = contextValue.trim() ? JSON.parse(contextValue) : {};
      const parsedNestedContext = nestedContextValue.trim() ? JSON.parse(nestedContextValue) : {};

      const { runId } = await createWorkflowRun({ workflowId, prevRunId });

      const stepArr = stepKey.split('.');
      if (stepArr.length === 1 && Object.keys(parsedContext)?.length > 0) {
        parsedContext[stepKey] = {
          status: 'running',
          payload: data,
        };
      }

      if (stepArr.length > 1 && Object.keys(parsedNestedContext)?.length > 0) {
        const nestedParentPath = stepArr.slice(0, -1);
        const leafKey = stepArr.at(-1);
        const parent = nestedParentPath.length
          ? ensureNestedPath(parsedNestedContext, nestedParentPath)
          : parsedNestedContext;
        if (leafKey) {
          parent[leafKey] = {
            status: 'running',
            payload: data,
          };
        }
      }

      const payload = {
        runId,
        workflowId,
        step: stepKey,
        inputData: data,
        resumeData: Object.keys(parsedResume)?.length > 0 ? parsedResume : undefined,
        context: Object.keys(parsedContext)?.length > 0 ? parsedContext : undefined,
        nestedStepsContext: Object.keys(parsedNestedContext)?.length > 0 ? parsedNestedContext : undefined,
        requestContext: requestContext,
      };

      timeTravelWorkflowStream(payload);
    } catch (error) {
      console.error('Invalid JSON provided', error);
      setFormError(error instanceof Error ? error.message : 'Error time traveling workflow');
    } finally {
      setIsSubmitting(false);
      closeModal();
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Txt as="p" variant="ui-lg" className="text-icon3">
            Input data
          </Txt>
          <Txt variant="ui-xs" className="text-icon3">
            Step: {stepKey}
          </Txt>
        </div>

        <WorkflowInputData
          schema={stepSchema}
          defaultValues={stepResult?.payload}
          isSubmitLoading={isSubmitting}
          submitButtonLabel="Start time travel"
          onSubmit={handleSubmit}
        >
          <div className="space-y-4 pb-4">
            <JsonField
              label="Resume Data (JSON)"
              value={resumeData}
              onChange={setResumeData}
              helperText="Provide any resume payloads that should be passed to the step."
            />
            <JsonField
              label="Context (JSON)"
              value={contextValue}
              onChange={setContextValue}
              helperText="Only include top level steps (no nested workflow steps)."
            />
            <JsonField
              label="Nested Step Context (JSON)"
              value={nestedContextValue}
              onChange={setNestedContextValue}
              helperText="Includes nested workflow steps."
            />
            {formError && (
              <Txt variant="ui-sm" className="text-accent2">
                {formError}
              </Txt>
            )}
          </div>
        </WorkflowInputData>
      </div>
    </TooltipProvider>
  );
};
