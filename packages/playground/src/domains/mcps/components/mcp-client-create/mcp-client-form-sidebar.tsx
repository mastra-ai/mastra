import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Label } from '@mastra/playground-ui/components/Label';
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
// re-stating it for hover/focus-visible keeps the whole form a uniform surface3 (incl. the Select).
const SOLID_FIELD = 'bg-surface3 hover:bg-surface3 focus-visible:bg-surface3';

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
        <div className="flex flex-col gap-6 p-4">
          <SectionHeader title="Identity" subtitle="Define the MCP client name and description." />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mcp-client-name" className="text-neutral5 text-xs">
              Name <span className="text-accent2">*</span>
            </Label>
            <Input
              id="mcp-client-name"
              placeholder="My MCP Client"
              className={SOLID_FIELD}
              disabled={readOnly}
              {...register('name')}
              error={!!errors.name}
            />
            {errors.name && <span className="text-accent2 text-xs">{errors.name.message}</span>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mcp-client-description" className="text-neutral5 text-xs">
              Description
            </Label>
            <Textarea
              id="mcp-client-description"
              placeholder="Describe what this MCP client connects to"
              className={SOLID_FIELD}
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
                  container={containerRef}
                />
              </div>
            </>
          )}

          <SectionHeader title="Server Configuration" subtitle="Configure the MCP server connection details." />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mcp-server-name" className="text-neutral5 text-xs">
              Server Name <span className="text-accent2">*</span>
            </Label>
            <Input
              id="mcp-server-name"
              placeholder="default"
              className={SOLID_FIELD}
              disabled={readOnly}
              {...register('serverName')}
              error={!!errors.serverName}
            />
            {errors.serverName && <span className="text-accent2 text-xs">{errors.serverName.message}</span>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-neutral5 text-xs">Server Type</Label>
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
                <Label htmlFor="mcp-url" className="text-neutral5 text-xs">
                  URL <span className="text-accent2">*</span>
                </Label>
                <Input
                  id="mcp-url"
                  placeholder="http://localhost:4111/api/mcp/server/mcp"
                  className={SOLID_FIELD}
                  disabled={readOnly}
                  {...register('url')}
                  error={!!errors.url}
                />
                {errors.url && <span className="text-accent2 text-xs">{errors.url.message}</span>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mcp-timeout" className="text-neutral5 text-xs">
                  Timeout (ms)
                </Label>
                <Input
                  id="mcp-timeout"
                  type="number"
                  placeholder="30000"
                  className={SOLID_FIELD}
                  disabled={readOnly}
                  {...register('timeout', { valueAsNumber: true })}
                />
              </div>
            </>
          )}

          {serverType === 'stdio' && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mcp-command" className="text-neutral5 text-xs">
                  Command <span className="text-accent2">*</span>
                </Label>
                <Input
                  id="mcp-command"
                  placeholder="npx"
                  className={SOLID_FIELD}
                  disabled={readOnly}
                  {...register('command')}
                  error={!!errors.command}
                />
                {errors.command && <span className="text-accent2 text-xs">{errors.command.message}</span>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mcp-args" className="text-neutral5 text-xs">
                  Arguments (one per line)
                </Label>
                <Textarea
                  id="mcp-args"
                  placeholder={'-y\n@modelcontextprotocol/server'}
                  className={SOLID_FIELD}
                  disabled={readOnly}
                  {...register('args')}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-neutral5 text-xs">Environment Variables</Label>
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
                    <Button variant="outline" size="sm" onClick={addEnvVar} className="w-fit">
                      <PlusIcon className="mr-1 h-3 w-3" />
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
                <Button
                  variant="outline"
                  onClick={onTryConnect}
                  disabled={isDisabled}
                  className="w-full"
                  tooltip={tooltipContent}
                >
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
