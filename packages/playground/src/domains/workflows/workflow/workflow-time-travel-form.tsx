import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { FieldBlock, fieldErrorId } from '@mastra/playground-ui/components/FormFieldBlocks';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useCopyToClipboard } from '@mastra/playground-ui/hooks/use-copy-to-clipboard';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { raisedSurfaceStyle } from '@mastra/playground-ui/primitives/raised-surface';
import { quietTextHover } from '@mastra/playground-ui/primitives/typography';
import { cn } from '@mastra/playground-ui/utils/cn';
import { formatJSON, isValidJson } from '@mastra/playground-ui/utils/formatting';
import { Braces, ChevronDown, CopyIcon, EyeIcon, EyeOffIcon } from 'lucide-react';
import { useContext, useId, useMemo, useState } from 'react';
import { parse } from 'superjson';
import { z } from 'zod';
import { WorkflowRunContext } from '../context/workflow-run-context';
import { WorkflowInputData } from './workflow-input-data';
import { useMergedRequestContext } from '@/domains/request-context/context/schema-request-context';
import { jsonSchemaToZodRuntime } from '@/lib/form/json-schema-to-zod-runtime';

const buttonClass = quietTextHover;

export type WorkflowTimeTravelFormProps = {
  stepKey: string;
  closeModal: () => void;
  isPerStepRun?: boolean;
  isContinueRun?: boolean;
  buttonText?: string;
  inputData?: unknown;
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
  exampleCode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  helperText?: string;
  exampleCode?: string;
}) => {
  const fieldName = useId();
  const { handleCopy } = useCopyToClipboard({ text: value });
  const { handleCopy: handleCopyExample } = useCopyToClipboard({ text: exampleCode ?? '{}' });
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isExampleOpen, setIsExampleOpen] = useState(false);

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
    <>
      {isExampleOpen && (
        <div className={cn(raisedSurfaceStyle, 'space-y-2 rounded-lg p-3')}>
          <div className="flex items-center gap-2">
            <Txt as="p" variant="caption" className="text-muted-foreground">
              Example {label}
            </Txt>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleCopyExample}
                  className={buttonClass}
                  aria-label="Copy example JSON"
                >
                  <Icon>
                    <CopyIcon />
                  </Icon>
                </button>
              </TooltipTrigger>
              <TooltipContent>Copy example JSON</TooltipContent>
            </Tooltip>
          </div>
          <CodeEditor
            value={exampleCode}
            language="json"
            editable={false}
            showCopyButton={false}
            aria-label={`Example ${label}`}
            className="h-[150px] w-full"
          />
        </div>
      )}
      <Collapsible className={cn(raisedSurfaceStyle, 'rounded-lg')} open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex w-full items-center justify-between px-3">
          <div>
            <FieldBlock.Label name={fieldName} size="bigger">
              {label}
            </FieldBlock.Label>
            {helperText && (
              <Txt variant="meta" className="text-muted-foreground">
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
            {exampleCode && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setIsExampleOpen(!isExampleOpen)}
                    className={buttonClass}
                    aria-label={isExampleOpen ? `Hide example JSON` : `View example JSON`}
                  >
                    <Icon>{isExampleOpen ? <EyeOffIcon /> : <EyeIcon />}</Icon>
                  </button>
                </TooltipTrigger>
                <TooltipContent>View example JSON</TooltipContent>
              </Tooltip>
            )}
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className={buttonClass}
                aria-label={isOpen ? `Collapse ${label}` : `Expand ${label}`}
              >
                <Icon className={cn('transition-transform', isOpen ? 'rotate-0' : '-rotate-90')}>
                  <ChevronDown />
                </Icon>
              </button>
            </CollapsibleTrigger>
          </div>
        </div>

        <CollapsibleContent className="space-y-2">
          <CodeEditor
            id={`input-${fieldName}`}
            value={value}
            onChange={onChange}
            language="json"
            showCopyButton={false}
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? fieldErrorId(fieldName) : undefined}
            className="h-[260px]"
          />

          {fieldError && <FieldBlock.ErrorMsg name={fieldName}>{fieldError}</FieldBlock.ErrorMsg>}
        </CollapsibleContent>
      </Collapsible>
    </>
  );
};

export const WorkflowTimeTravelForm = ({
  stepKey,
  closeModal,
  isPerStepRun,
  isContinueRun,
  buttonText = 'Start time travel',
  inputData,
}: WorkflowTimeTravelFormProps) => {
  const {
    result,
    workflow,
    timeTravelWorkflowStream,
    runId: prevRunId,
    workflowId,
    setDebugMode,
  } = useContext(WorkflowRunContext);

  const requestContext = useMergedRequestContext();
  const stepResult = inputData ? { payload: inputData } : result?.steps?.[stepKey];
  const [resumeData, setResumeData] = useState(() => '{}');
  const [contextValue, setContextValue] = useState(() => '{}');
  const [nestedContextValue, setNestedContextValue] = useState(() => '{}');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const stepDefinition = workflow?.allSteps?.[stepKey];

  const { schema: stepSchema } = useMemo(() => {
    if (!stepDefinition?.inputSchema) {
      return { schema: z.record(z.string(), z.any()) };
    }

    try {
      const parsed = parse(stepDefinition.inputSchema);
      const zodStateSchema = workflow?.stateSchema ? jsonSchemaToZodRuntime(parse(workflow.stateSchema)) : null;

      const zodStepSchema = jsonSchemaToZodRuntime(parsed as any);

      const schemaToUse = zodStateSchema
        ? z.object({
            inputData: zodStepSchema,
            initialState: zodStateSchema.optional(),
          })
        : zodStepSchema;
      return { schema: schemaToUse, schemaError: null };
    } catch (err) {
      console.error('Failed to parse step schema', err);
      return { schema: z.record(z.string(), z.any()) };
    }
  }, [stepDefinition?.inputSchema, workflow?.stateSchema]);

  const handleSubmit = async (data: Record<string, any>) => {
    setFormError(null);
    setIsSubmitting(true);

    try {
      const parsedResume = resumeData.trim() ? JSON.parse(resumeData) : {};
      const parsedContext = contextValue.trim() ? JSON.parse(contextValue) : {};
      const parsedNestedContext = nestedContextValue.trim() ? JSON.parse(nestedContextValue) : {};
      const { initialState, inputData: dataInputData } = data ?? {};
      const inputData = workflow?.stateSchema ? dataInputData : data;

      const payload = {
        runId: prevRunId,
        workflowId,
        step: stepKey,
        inputData,
        initialState,
        resumeData: Object.keys(parsedResume)?.length > 0 ? parsedResume : undefined,
        context: Object.keys(parsedContext)?.length > 0 ? parsedContext : undefined,
        nestedStepsContext: Object.keys(parsedNestedContext)?.length > 0 ? parsedNestedContext : undefined,
        requestContext: requestContext,
        ...(isContinueRun ? { perStep: false } : {}),
      };

      if (isContinueRun) {
        setDebugMode(false);
      }

      void timeTravelWorkflowStream(payload);

      closeModal();
    } catch (error) {
      console.error('Invalid JSON provided', error);
      setFormError(error instanceof Error ? error.message : 'Error time traveling workflow');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Txt as="p" variant="heading" className="text-muted-foreground">
            Input data
          </Txt>
          <Txt variant="meta" className="text-muted-foreground">
            Step: {stepKey}
          </Txt>
        </div>

        <WorkflowInputData
          schema={stepSchema}
          defaultValues={stepResult?.payload}
          isSubmitLoading={isSubmitting}
          submitButtonLabel={buttonText}
          onSubmit={handleSubmit}
        >
          <div className="space-y-4 pb-4">
            {isPerStepRun || isContinueRun ? null : (
              <>
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
                  helperText="Only include top level steps (no nested workflow steps) that are required in the time travel execution."
                  exampleCode={prettyJson({
                    stepId: {
                      status: 'success',
                      payload: {
                        value: 'test value',
                      },
                      output: {
                        value: 'test output',
                      },
                    },
                  })}
                />
                <JsonField
                  label="Nested Step Context (JSON)"
                  value={nestedContextValue}
                  onChange={setNestedContextValue}
                  helperText="Includes nested workflow steps that are required in the time travel execution."
                  exampleCode={prettyJson({
                    nestedWorkflowId: {
                      stepId: {
                        status: 'success',
                        payload: {
                          value: 'test value',
                        },
                        output: {
                          value: 'test output',
                        },
                      },
                    },
                  })}
                />
              </>
            )}
            {formError && (
              <div role="alert">
                <Notice variant="destructive">{formError}</Notice>
              </div>
            )}
          </div>
        </WorkflowInputData>
      </div>
    </TooltipProvider>
  );
};
