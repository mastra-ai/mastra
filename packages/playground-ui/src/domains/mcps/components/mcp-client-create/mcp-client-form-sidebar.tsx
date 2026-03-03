import { Controller, type UseFormReturn, useWatch } from 'react-hook-form';
import { Check, PlusIcon, XIcon } from 'lucide-react';

import { ScrollArea } from '@/ds/components/ScrollArea';
import { Button } from '@/ds/components/Button';
import { ButtonWithTooltip } from '@/ds/components/Button/ButtonWithTooltip';
import { Icon } from '@/ds/icons';
import { Spinner } from '@/ds/components/Spinner';
import { Input } from '@/ds/components/Input';
import { Textarea } from '@/ds/components/Textarea';
import { Label } from '@/ds/components/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ds/components/Select';
import { SectionHeader } from '@/domains/cms';
import { MCPServerCombobox } from '../mcp-server-combobox';

import type { MCPClientFormValues } from './use-mcp-client-form';

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
    <div className="h-full flex flex-col">
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-6 p-4">
          <SectionHeader title="Identity" subtitle="Define the MCP client name and description." />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mcp-client-name" className="text-xs text-neutral5">
              Name <span className="text-accent2">*</span>
            </Label>
            <Input
              id="mcp-client-name"
              placeholder="My MCP Client"
              className="bg-surface3"
              disabled={readOnly}
              {...register('name')}
              error={!!errors.name}
            />
            {errors.name && <span className="text-xs text-accent2">{errors.name.message}</span>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mcp-client-description" className="text-xs text-neutral5">
              Description
            </Label>
            <Textarea
              id="mcp-client-description"
              placeholder="Describe what this MCP client connects to"
              className="bg-surface3"
              disabled={readOnly}
              {...register('description')}
            />
          </div>

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
                  variant="light"
                  container={containerRef}
                />
              </div>
            </>
          )}

          <SectionHeader title="Server Configuration" subtitle="Configure the MCP server connection details." />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mcp-server-name" className="text-xs text-neutral5">
              Server Name <span className="text-accent2">*</span>
            </Label>
            <Input
              id="mcp-server-name"
              placeholder="default"
              className="bg-surface3"
              disabled={readOnly}
              {...register('serverName')}
              error={!!errors.serverName}
            />
            {errors.serverName && <span className="text-xs text-accent2">{errors.serverName.message}</span>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-neutral5">Server Type</Label>
            <Controller
              name="serverType"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                  <SelectTrigger className="bg-surface3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="http">HTTP</SelectItem>
                    <SelectItem value="stdio">Stdio</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {serverType === 'http' && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mcp-url" className="text-xs text-neutral5">
                  URL <span className="text-accent2">*</span>
                </Label>
                <Input
                  id="mcp-url"
                  placeholder="http://localhost:4111/api/mcp/server/mcp"
                  className="bg-surface3"
                  disabled={readOnly}
                  {...register('url')}
                  error={!!errors.url}
                />
                {errors.url && <span className="text-xs text-accent2">{errors.url.message}</span>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mcp-timeout" className="text-xs text-neutral5">
                  Timeout (ms)
                </Label>
                <Input
                  id="mcp-timeout"
                  type="number"
                  placeholder="30000"
                  className="bg-surface3"
                  disabled={readOnly}
                  {...register('timeout', { valueAsNumber: true })}
                />
              </div>
            </>
          )}

          {serverType === 'stdio' && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mcp-command" className="text-xs text-neutral5">
                  Command <span className="text-accent2">*</span>
                </Label>
                <Input
                  id="mcp-command"
                  placeholder="npx"
                  className="bg-surface3"
                  disabled={readOnly}
                  {...register('command')}
                  error={!!errors.command}
                />
                {errors.command && <span className="text-xs text-accent2">{errors.command.message}</span>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mcp-args" className="text-xs text-neutral5">
                  Arguments (one per line)
                </Label>
                <Textarea
                  id="mcp-args"
                  placeholder={'-y\n@modelcontextprotocol/server'}
                  className="bg-surface3"
                  disabled={readOnly}
                  {...register('args')}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-neutral5">Environment Variables</Label>
                <div className="flex flex-col gap-2">
                  {env.map((_, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <Input
                        placeholder="KEY"
                        className="bg-surface3 flex-1"
                        disabled={readOnly}
                        {...register(`env.${index}.key`)}
                      />
                      <Input
                        placeholder="VALUE"
                        className="bg-surface3 flex-1"
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
                    <Button variant="outline" size="sm" onClick={addEnvVar} className="w-fit">
                      <PlusIcon className="h-3 w-3 mr-1" />
                      Add variable
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </ScrollArea>

      {(showSubmit ?? !readOnly) && (
        <div className="flex-shrink-0 p-4 flex flex-col gap-2">
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
                <ButtonWithTooltip
                  variant="outline"
                  onClick={onTryConnect}
                  disabled={isDisabled}
                  className="w-full"
                  tooltipContent={tooltipContent}
                >
                  {isTryingConnect ? (
                    <>
                      <Spinner className="h-4 w-4" />
                      Connecting...
                    </>
                  ) : (
                    'Try to connect'
                  )}
                </ButtonWithTooltip>
              ) : (
                <Button variant="outline" onClick={onTryConnect} disabled={isDisabled} className="w-full">
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
