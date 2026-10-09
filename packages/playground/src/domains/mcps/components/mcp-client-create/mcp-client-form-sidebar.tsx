import { Button } from '@mastra/playground-ui/components/Button';
import { Field, FieldError, FieldLabel, Fieldset, FieldsetLegend } from '@mastra/playground-ui/components/Field';
import { Input } from '@mastra/playground-ui/components/Input';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui/components/Select';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Textarea } from '@mastra/playground-ui/components/Textarea';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { Check, PlusIcon, XIcon } from 'lucide-react';
import { Controller, useWatch } from 'react-hook-form';
import type { UseFormReturn } from 'react-hook-form';

import { MCPServerCombobox } from '../mcp-server-combobox';
import type { MCPClientFormValues } from './use-mcp-client-form';
import { SectionHeader } from '@/domains/cms';

interface MCPClientFormSidebarProps {
  form: UseFormReturn<MCPClientFormValues>;
  onPublish: () => void;
  isSubmitting: boolean;
  onPreFillFromServer: (serverId: string) => void;
  containerRef?: React.RefObject<HTMLElement | null>;
  readOnly?: boolean;
  showSubmit?: boolean;
  submitLabel?: string;
  onTryConnect?: () => void;
  isTryingConnect?: boolean;
}

// Pin these fields to a solid surface. The filled Input/Textarea default otherwise swaps the
// background to a translucent overlay on hover/focus, which leaks through the forced solid bg —
// re-stating it for hover/focus-visible keeps the whole form a uniform card (incl. the Select).
const SOLID_FIELD = 'bg-card hover:bg-card focus-visible:bg-card';

export function MCPClientFormSidebar({
  form,
  onPublish,
  isSubmitting,
  onPreFillFromServer,
  containerRef,
  readOnly,
  showSubmit,
  submitLabel = 'Create MCP Client',
  onTryConnect,
  isTryingConnect,
}: MCPClientFormSidebarProps) {
  const {
    register,
    control,
    formState: { errors },
    setValue,
    getValues,
  } = form;

  const serverType = useWatch({ control, name: 'serverType' });
  const url = useWatch({ control, name: 'url' });
  const env = useWatch({ control, name: 'env' });

  const addEnvVar = () => {
    const current = getValues('env');
    setValue('env', [...current, { key: '', value: '' }]);
  };

  const removeEnvVar = (index: number) => {
    const current = getValues('env');
    setValue(
      'env',
      current.filter((_, i) => i !== index),
    );
  };

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 p-4">
          <SectionHeader title="Identity" subtitle="Define the MCP client name and description." />

          <Field invalid={Boolean(errors.name)} disabled={readOnly}>
            <FieldLabel required>Name</FieldLabel>
            <Input placeholder="My MCP Client" className={SOLID_FIELD} {...register('name')} />
            <FieldError>{errors.name?.message}</FieldError>
          </Field>

          <Field disabled={readOnly}>
            <FieldLabel>Description</FieldLabel>
            <Textarea
              placeholder="Describe what this MCP client connects to"
              className={SOLID_FIELD}
              {...register('description')}
            />
          </Field>

          {!readOnly && (
            <>
              <SectionHeader
                title="Pre-fill from server"
                subtitle="Select an existing MCP server to pre-fill settings."
              />

              <div className="flex flex-col gap-1.5">
                <MCPServerCombobox
                  onValueChange={onPreFillFromServer}
                  placeholder="Select a server..."
                  searchPlaceholder="Search servers..."
                  emptyText="No servers found"
                  container={containerRef}
                />
              </div>
            </>
          )}

          <SectionHeader title="Server Configuration" subtitle="Configure the MCP server connection details." />

          <Field invalid={Boolean(errors.serverName)} disabled={readOnly}>
            <FieldLabel required>Server Name</FieldLabel>
            <Input placeholder="default" className={SOLID_FIELD} {...register('serverName')} />
            <FieldError>{errors.serverName?.message}</FieldError>
          </Field>

          <Field disabled={readOnly}>
            <FieldLabel>Server Type</FieldLabel>
            <Controller
              name="serverType"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="http">HTTP</SelectItem>
                    <SelectItem value="stdio">Stdio</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          {serverType === 'http' && (
            <>
              <Field invalid={Boolean(errors.url)} disabled={readOnly}>
                <FieldLabel required>URL</FieldLabel>
                <Input
                  placeholder="http://localhost:4111/api/mcp/server/mcp"
                  className={SOLID_FIELD}
                  {...register('url')}
                />
                <FieldError>{errors.url?.message}</FieldError>
              </Field>

              <Field disabled={readOnly}>
                <FieldLabel>Timeout (ms)</FieldLabel>
                <Input
                  type="number"
                  placeholder="30000"
                  className={SOLID_FIELD}
                  {...register('timeout', { valueAsNumber: true })}
                />
              </Field>
            </>
          )}

          {serverType === 'stdio' && (
            <>
              <Field invalid={Boolean(errors.command)} disabled={readOnly}>
                <FieldLabel required>Command</FieldLabel>
                <Input placeholder="npx" className={SOLID_FIELD} {...register('command')} />
                <FieldError>{errors.command?.message}</FieldError>
              </Field>

              <Field disabled={readOnly}>
                <FieldLabel>Arguments (one per line)</FieldLabel>
                <Textarea
                  placeholder={'-y\n@modelcontextprotocol/server'}
                  className={SOLID_FIELD}
                  {...register('args')}
                />
              </Field>

              <Fieldset disabled={readOnly} className="gap-1.5">
                <FieldsetLegend>Environment Variables</FieldsetLegend>
                <div className="flex flex-col gap-2">
                  {env.map((_, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        placeholder="KEY"
                        className={`${SOLID_FIELD} flex-1`}
                        disabled={readOnly}
                        {...register(`env.${index}.key`)}
                      />
                      <Input
                        placeholder="VALUE"
                        className={`${SOLID_FIELD} flex-1`}
                        disabled={readOnly}
                        {...register(`env.${index}.value`)}
                      />
                      {!readOnly && (
                        <Button variant="ghost" size="sm" onClick={() => removeEnvVar(index)}>
                          <XIcon className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {!readOnly && (
                    <Button size="sm" onClick={addEnvVar} className="w-fit" icon={<PlusIcon />}>
                      Add variable
                    </Button>
                  )}
                </div>
              </Fieldset>
            </>
          )}
        </div>
      </ScrollArea>

      {(showSubmit ?? !readOnly) && (
        <div className="flex shrink-0 flex-col gap-2 p-4">
          {!readOnly &&
            (() => {
              const isDisabled = serverType !== 'http' || !url.trim() || isTryingConnect;
              const tooltipContent =
                serverType !== 'http'
                  ? 'Only available for HTTP servers'
                  : !url.trim()
                    ? 'Enter a URL first'
                    : undefined;

              return tooltipContent ? (
                <Button onClick={onTryConnect} disabled={isDisabled} className="w-full" tooltip={tooltipContent}>
                  {isTryingConnect ? (
                    <>
                      <Spinner className="h-4 w-4" />
                      Connecting...
                    </>
                  ) : (
                    'Try to connect'
                  )}
                </Button>
              ) : (
                <Button onClick={onTryConnect} disabled={isDisabled} className="w-full">
                  {isTryingConnect ? (
                    <>
                      <Spinner className="h-4 w-4" />
                      Connecting...
                    </>
                  ) : (
                    'Try to connect'
                  )}
                </Button>
              );
            })()}
          <Button variant="primary" onClick={onPublish} disabled={isSubmitting} className="w-full">
            {isSubmitting ? (
              <>
                <Spinner className="h-4 w-4" />
                Creating...
              </>
            ) : (
              <>
                <Icon>
                  <Check />
                </Icon>
                {submitLabel}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
