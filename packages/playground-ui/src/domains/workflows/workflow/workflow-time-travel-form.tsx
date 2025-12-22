import { useContext, useMemo, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { jsonLanguage } from '@codemirror/lang-json';
import { useCodemirrorTheme } from '@/components/syntax-highlighter';
import { WorkflowInputData } from './workflow-input-data';
import { WorkflowRunContext } from '../context/workflow-run-context';
import { Txt } from '@/ds/components/Txt';
import { Icon } from '@/ds/icons';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Braces, ChevronDown, CopyIcon, EyeIcon, EyeOffIcon } from 'lucide-react';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { formatJSON, isValidJson } from '@/lib/formatting';
import { jsonSchemaToZod } from '@mastra/schema-compat/json-to-zod';
import { parse } from 'superjson';
import { resolveSerializedZodOutput } from '@/components/dynamic-form/utils';
import { z } from 'zod';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { usePlaygroundStore } from '@/store/playground-store';

const buttonClass = 'text-icon3 hover:text-icon6';

export type WorkflowTimeTravelFormProps = {
  stepKey: string;
  closeModal: () => void;
  isPerStepRun?: boolean;
  isContinueRun?: boolean;
  buttonText?: string;
  inputData?: any;
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
  const theme = useCodemirrorTheme();
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
        <div className="border border-border1 rounded-lg bg-surface3 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Txt as="p" variant="ui-sm" className="text-icon3">
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
          <CodeMirror
            value={exampleCode}
            theme={theme}
            extensions={[jsonLanguage]}
            className="h-[150px] w-full overflow-y-scroll bg-surface3 rounded-lg overflow-scroll p-3"
          />
        </div>
      )}
      <Collapsible className="border border-border1 rounded-lg bg-surface3" open={isOpen} onOpenChange={setIsOpen}>
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
  const { requestContext } = usePlaygroundStore();
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
      return { schema: resolveSerializedZodOutput(jsonSchemaToZod(parsed as any)), schemaError: null };
    } catch (err) {
      console.error('Failed to parse step schema', err);
      return { schema: z.record(z.string(), z.any()) };
    }
  }, [stepDefinition?.inputSchema]);

  const handleSubmit = async (data: Record<string, any>) => {
    setFormError(null);
    setIsSubmitting(true);

    try {
      const parsedResume = resumeData.trim() ? JSON.parse(resumeData) : {};
      const parsedContext = contextValue.trim() ? JSON.parse(contextValue) : {};
      const parsedNestedContext = nestedContextValue.trim() ? JSON.parse(nestedContextValue) : {};

      const payload = {
        runId: prevRunId,
        workflowId,
        step: stepKey,
        inputData: data,
        resumeData: Object.keys(parsedResume)?.length > 0 ? parsedResume : undefined,
        context: Object.keys(parsedContext)?.length > 0 ? parsedContext : undefined,
        nestedStepsContext: Object.keys(parsedNestedContext)?.length > 0 ? parsedNestedContext : undefined,
        requestContext: requestContext,
        ...(isContinueRun ? { perStep: false } : {}),
      };

      if (isContinueRun) {
        setDebugMode(false);
      }

      timeTravelWorkflowStream(payload);

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
