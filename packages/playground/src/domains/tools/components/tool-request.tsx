import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { Field, FieldError } from '@mastra/playground-ui/components/Field';
import { Tab, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import { Txt } from '@mastra/playground-ui/components/Txt';
import type { RequestContextEntityType } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { FormSubmitRow } from '@mastra/playground-ui/lib/form/components/form-submit-row';
import { DynamicForm } from '@mastra/playground-ui/lib/form/dynamic-form';
import { isEmptyZodObject } from '@mastra/playground-ui/lib/form/is-empty-zod-object';
import { getFormShapeError, parseJsonDraft, validateJsonDraft } from '@mastra/playground-ui/lib/form/json-draft';
import { SettingsContainer, SettingsGroup, SettingsTitle } from '@mastra/playground-ui/new/settings';
import { Braces, FormInput, PlayIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import type { ZodType } from 'zod';
import { ToolSectionHeader } from './tool-section-header';
import { RequestContextPopover } from '@/domains/run-options/components/request-context-popover';

export interface ToolRequestProps {
  zodInputSchema: ZodType;
  isRunning: boolean;
  onRun: (data: unknown) => void;
  requestContextEntityType: RequestContextEntityType;
  requestContextEntityId: string;
}

type RequestView = 'form' | 'json';

type RequestDraft = { view: 'form'; value: unknown } | { view: 'json'; value: string };

export function ToolRequest({
  zodInputSchema,
  isRunning,
  onRun,
  requestContextEntityType,
  requestContextEntityId,
}: ToolRequestProps) {
  const hasInputFields = !isEmptyZodObject(zodInputSchema);
  const [draft, setDraft] = useState<RequestDraft>({ view: 'form', value: undefined });
  // The Form view is uncontrolled: state here would only re-render this tree on every keystroke.
  const formValues = useRef<unknown>(undefined);
  const [errors, setErrors] = useState<string[]>([]);

  function changeView(view: RequestView) {
    if (view === draft.view) return;
    setErrors([]);
    if (draft.view === 'form') {
      return setDraft({ view: 'json', value: JSON.stringify(formValues.current ?? {}, null, 2) });
    }
    const json = parseJsonDraft(draft.value);
    if (!json.ok) return setErrors([json.error]);
    const formShapeError = getFormShapeError(zodInputSchema, json.value);
    if (formShapeError) return setErrors([formShapeError]);
    formValues.current = json.value;
    setDraft({ view: 'form', value: json.value });
  }

  function runJson(text: string) {
    const result = validateJsonDraft(zodInputSchema, text);
    if (result.ok) onRun(result.value);
    else setErrors(result.errors);
  }

  const submitProps = {
    isSubmitLoading: isRunning,
    submitButtonLabel: 'Run',
    submitButtonIcon: <PlayIcon />,
    submitButtonVariant: 'primary',
  } as const;

  return (
    <SettingsGroup>
      <ToolSectionHeader
        action={
          <div className="flex items-center gap-1">
            <RequestContextPopover entityType={requestContextEntityType} entityId={requestContextEntityId} />
            <Tabs<RequestView> defaultTab="form" value={draft.view} onValueChange={changeView}>
              <TabList size="md">
                <Tab value="form" disabled={isRunning}>
                  <Icon size="sm">
                    <FormInput />
                  </Icon>
                  Form
                </Tab>
                <Tab value="json" disabled={isRunning}>
                  <Icon size="sm">
                    <Braces />
                  </Icon>
                  JSON
                </Tab>
              </TabList>
            </Tabs>
          </div>
        }
      >
        <SettingsTitle>Request</SettingsTitle>
      </ToolSectionHeader>
      <SettingsContainer>
        <div className="p-4">
          {draft.view === 'json' ? (
            <div className="grid gap-4">
              <Field invalid={errors.length > 0}>
                <CodeEditor
                  variant="embedded"
                  language="json"
                  value={draft.value}
                  onChange={value => {
                    setDraft({ view: 'json', value });
                    setErrors([]);
                  }}
                  editable={!isRunning}
                  aria-label="Request JSON"
                />
                {errors.length > 0 && (
                  <FieldError>
                    {errors.map(error => (
                      <span key={error} className="block">
                        {error}
                      </span>
                    ))}
                  </FieldError>
                )}
              </Field>
              <FormSubmitRow {...submitProps} onSubmit={() => runJson(draft.value)} />
            </div>
          ) : (
            <DynamicForm
              {...submitProps}
              schema={zodInputSchema}
              defaultValues={draft.value}
              onValuesChange={values => {
                formValues.current = values;
              }}
              onSubmit={onRun}
              // Each field already pads its bottom, so the form's own gap would double the space between fields and above Run.
              className="gap-0"
            >
              {!hasInputFields && (
                <Txt variant="body-sm" tone="muted" className="pb-4">
                  This tool takes no input. Run it as is.
                </Txt>
              )}
            </DynamicForm>
          )}
        </div>
      </SettingsContainer>
    </SettingsGroup>
  );
}
