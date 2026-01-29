'use client';

import { useState } from 'react';
import { Loader2, CheckCircle2, XCircle, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/ds/components/Button';
import { Input } from '@/ds/components/Input';
import { Tabs, TabList, Tab, TabContent } from '@/ds/components/Tabs';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

/**
 * Transport type for MCP connections
 */
export type MCPTransportType = 'http' | 'stdio';

/**
 * Configuration for MCP connection
 */
export interface MCPConnectionConfig {
  /** Transport type */
  transport: MCPTransportType;

  /** User-provided name for the MCP server */
  name?: string;

  // HTTP transport config
  /** MCP server URL (HTTP/SSE endpoint) - required for HTTP transport */
  url?: string;
  /** Optional authentication headers for HTTP transport */
  headers?: Record<string, string>;

  // Stdio transport config
  /** Command to execute (e.g., 'npx', 'node', 'python') - required for stdio transport */
  command?: string;
  /** Arguments to pass to the command */
  args?: string[];
  /** Environment variables for the subprocess */
  env?: Record<string, string>;
}

/**
 * Props for the MCPConnectionInput component
 */
export interface MCPConnectionInputProps {
  /** Callback when validation succeeds with tool count */
  onSuccess?: (config: MCPConnectionConfig, toolCount: number) => void;
  /** Whether validation is in progress */
  isValidating?: boolean;
  /** Error message from validation */
  validationError?: string;
  /** Function to trigger validation */
  onValidate?: (config: MCPConnectionConfig) => Promise<void>;
  /** Optional CSS class name */
  className?: string;
}

/**
 * MCP connection input form supporting both HTTP and Stdio transports.
 *
 * Provides tabbed interface for:
 * - HTTP/SSE: Remote MCP servers via URL with optional headers
 * - Stdio: Local MCP servers via command execution
 *
 * @example
 * ```tsx
 * <MCPConnectionInput
 *   onValidate={async (config) => {
 *     const result = await client.validateMCPConnection(config);
 *     if (!result.valid) throw new Error(result.error);
 *   }}
 *   onSuccess={(config, toolCount) => {
 *     console.log(`Connected with ${toolCount} tools`);
 *   }}
 * />
 * ```
 */
export function MCPConnectionInput({
  onSuccess,
  isValidating = false,
  validationError,
  onValidate,
  className,
}: MCPConnectionInputProps) {
  // Name for the MCP server
  const [name, setName] = useState('');

  // Transport selection
  const [transport, setTransport] = useState<MCPTransportType>('http');

  // HTTP transport state
  const [url, setUrl] = useState('');
  const [showHeaders, setShowHeaders] = useState(false);
  const [headerKey, setHeaderKey] = useState('');
  const [headerValue, setHeaderValue] = useState('');
  const [headers, setHeaders] = useState<Record<string, string>>({});

  // Stdio transport state
  const [command, setCommand] = useState('');
  const [argsText, setArgsText] = useState('');
  const [showEnv, setShowEnv] = useState(false);
  const [envKey, setEnvKey] = useState('');
  const [envValue, setEnvValue] = useState('');
  const [env, setEnv] = useState<Record<string, string>>({});

  // Shared state
  const [localError, setLocalError] = useState<string | undefined>();
  const [validatedToolCount, setValidatedToolCount] = useState<number | null>(null);

  const error = validationError || localError;

  // HTTP header management
  const handleAddHeader = () => {
    if (headerKey && headerValue) {
      setHeaders(prev => ({ ...prev, [headerKey]: headerValue }));
      setHeaderKey('');
      setHeaderValue('');
    }
  };

  const handleRemoveHeader = (key: string) => {
    setHeaders(prev => {
      const newHeaders = { ...prev };
      delete newHeaders[key];
      return newHeaders;
    });
  };

  // Stdio env management
  const handleAddEnv = () => {
    if (envKey && envValue) {
      setEnv(prev => ({ ...prev, [envKey]: envValue }));
      setEnvKey('');
      setEnvValue('');
    }
  };

  const handleRemoveEnv = (key: string) => {
    setEnv(prev => {
      const newEnv = { ...prev };
      delete newEnv[key];
      return newEnv;
    });
  };

  // Parse args from text input
  const parseArgs = (text: string): string[] => {
    if (!text.trim()) return [];
    // Split by whitespace, respecting quoted strings
    const args: string[] = [];
    const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      args.push(match[1] ?? match[2] ?? match[0]);
    }
    return args;
  };

  const handleValidate = async () => {
    setLocalError(undefined);
    setValidatedToolCount(null);

    if (transport === 'http') {
      // Validate URL format
      if (!url.trim()) {
        setLocalError('Please enter an MCP server URL');
        return;
      }

      try {
        // eslint-disable-next-line no-new
        new URL(url);
      } catch {
        setLocalError('Please enter a valid URL');
        return;
      }
    } else {
      // Validate command
      if (!command.trim()) {
        setLocalError('Please enter a command to execute');
        return;
      }
    }

    // Build config
    const config: MCPConnectionConfig =
      transport === 'http'
        ? {
            transport: 'http',
            name: name.trim() || undefined,
            url: url.trim(),
            headers: Object.keys(headers).length > 0 ? headers : undefined,
          }
        : {
            transport: 'stdio',
            name: name.trim() || undefined,
            command: command.trim(),
            args: parseArgs(argsText),
            env: Object.keys(env).length > 0 ? env : undefined,
          };

    // Call external validation
    if (onValidate) {
      try {
        await onValidate(config);
        // Validation succeeded - onSuccess will be called by the parent after it processes the result
      } catch (e) {
        setLocalError(e instanceof Error ? e.message : 'Validation failed');
      }
    }
  };

  const isValidInput = () => {
    if (transport === 'http') {
      if (!url.trim()) return false;
      try {
        // eslint-disable-next-line no-new
        new URL(url);
        return true;
      } catch {
        return false;
      }
    }
    return command.trim().length > 0;
  };

  const headerEntries = Object.entries(headers);
  const envEntries = Object.entries(env);

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Name field */}
      <div className="space-y-2">
        <Txt variant="ui-sm" className="text-icon6 font-medium">
          Server Name
        </Txt>
        <Input
          placeholder="My MCP Server"
          value={name}
          onChange={e => setName(e.target.value)}
          disabled={isValidating}
        />
        <Txt variant="ui-xs" className="text-icon3">
          A friendly name to identify this MCP server
        </Txt>
      </div>

      <Tabs<MCPTransportType>
        defaultTab="http"
        value={transport}
        onValueChange={value => {
          setTransport(value);
          setLocalError(undefined);
          setValidatedToolCount(null);
        }}
      >
        <TabList variant="buttons" className="mb-4">
          <Tab value="http">Remote Server (HTTP)</Tab>
          <Tab value="stdio">Local Server (Stdio)</Tab>
        </TabList>

        {/* HTTP Transport Tab */}
        <TabContent value="http">
          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <Txt variant="ui-sm" className="text-icon6 font-medium">
                MCP Server URL
              </Txt>
              <Input
                type="url"
                placeholder="https://mcp.example.com/sse"
                value={url}
                onChange={e => {
                  setUrl(e.target.value);
                  setLocalError(undefined);
                  setValidatedToolCount(null);
                }}
                className={cn(error && transport === 'http' && 'border-destructive1')}
                disabled={isValidating}
              />
              <Txt variant="ui-xs" className="text-icon3">
                Enter the URL of your MCP server (HTTP/SSE endpoint)
              </Txt>
            </div>

            {/* Headers section */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowHeaders(!showHeaders)}
                className="flex items-center gap-1 text-icon5 hover:text-icon6 transition-colors"
              >
                {showHeaders ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                <Txt variant="ui-sm" className="font-medium">
                  Authentication Headers (Optional)
                </Txt>
                {headerEntries.length > 0 && (
                  <span className="ml-2 text-xs bg-surface4 px-2 py-0.5 rounded">{headerEntries.length}</span>
                )}
              </button>

              {showHeaders && (
                <div className="space-y-3 pt-2">
                  {headerEntries.length > 0 && (
                    <div className="space-y-2">
                      {headerEntries.map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2 bg-surface3 rounded p-2">
                          <code className="text-xs flex-1 truncate">{key}</code>
                          <code className="text-xs text-icon3 flex-1 truncate">
                            {value.length > 20 ? `${value.slice(0, 20)}...` : value}
                          </code>
                          <button
                            type="button"
                            onClick={() => handleRemoveHeader(key)}
                            className="text-icon3 hover:text-destructive1 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Input
                      placeholder="Header name"
                      value={headerKey}
                      onChange={e => setHeaderKey(e.target.value)}
                      className="flex-1"
                      disabled={isValidating}
                    />
                    <Input
                      placeholder="Header value"
                      value={headerValue}
                      onChange={e => setHeaderValue(e.target.value)}
                      className="flex-1"
                      type="password"
                      disabled={isValidating}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="md"
                      onClick={handleAddHeader}
                      disabled={!headerKey || !headerValue || isValidating}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabContent>

        {/* Stdio Transport Tab */}
        <TabContent value="stdio">
          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <Txt variant="ui-sm" className="text-icon6 font-medium">
                Command
              </Txt>
              <Input
                placeholder="npx"
                value={command}
                onChange={e => {
                  setCommand(e.target.value);
                  setLocalError(undefined);
                  setValidatedToolCount(null);
                }}
                className={cn(error && transport === 'stdio' && 'border-destructive1')}
                disabled={isValidating}
              />
              <Txt variant="ui-xs" className="text-icon3">
                The command to execute (e.g., npx, node, python)
              </Txt>
            </div>

            <div className="space-y-2">
              <Txt variant="ui-sm" className="text-icon6 font-medium">
                Arguments
              </Txt>
              <Input
                placeholder="@modelcontextprotocol/server-filesystem /tmp"
                value={argsText}
                onChange={e => {
                  setArgsText(e.target.value);
                  setLocalError(undefined);
                  setValidatedToolCount(null);
                }}
                disabled={isValidating}
              />
              <Txt variant="ui-xs" className="text-icon3">
                Arguments to pass to the command (space-separated, use quotes for values with spaces)
              </Txt>
            </div>

            {/* Environment variables section */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowEnv(!showEnv)}
                className="flex items-center gap-1 text-icon5 hover:text-icon6 transition-colors"
              >
                {showEnv ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                <Txt variant="ui-sm" className="font-medium">
                  Environment Variables (Optional)
                </Txt>
                {envEntries.length > 0 && (
                  <span className="ml-2 text-xs bg-surface4 px-2 py-0.5 rounded">{envEntries.length}</span>
                )}
              </button>

              {showEnv && (
                <div className="space-y-3 pt-2">
                  {envEntries.length > 0 && (
                    <div className="space-y-2">
                      {envEntries.map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2 bg-surface3 rounded p-2">
                          <code className="text-xs flex-1 truncate">{key}</code>
                          <code className="text-xs text-icon3 flex-1 truncate">
                            {value.length > 20 ? `${value.slice(0, 20)}...` : value}
                          </code>
                          <button
                            type="button"
                            onClick={() => handleRemoveEnv(key)}
                            className="text-icon3 hover:text-destructive1 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Input
                      placeholder="Variable name"
                      value={envKey}
                      onChange={e => setEnvKey(e.target.value)}
                      className="flex-1"
                      disabled={isValidating}
                    />
                    <Input
                      placeholder="Value"
                      value={envValue}
                      onChange={e => setEnvValue(e.target.value)}
                      className="flex-1"
                      type="password"
                      disabled={isValidating}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="md"
                      onClick={handleAddEnv}
                      disabled={!envKey || !envValue || isValidating}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabContent>
      </Tabs>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 text-destructive1">
          <XCircle className="h-4 w-4" />
          <Txt variant="ui-sm">{error}</Txt>
        </div>
      )}

      {/* Success message */}
      {validatedToolCount !== null && (
        <div className="flex items-center gap-2 text-success1">
          <CheckCircle2 className="h-4 w-4" />
          <Txt variant="ui-sm">
            Connected successfully! Found {validatedToolCount} tool{validatedToolCount === 1 ? '' : 's'}.
          </Txt>
        </div>
      )}

      {/* Validate button */}
      <div className="flex justify-end">
        <Button onClick={handleValidate} disabled={!isValidInput() || isValidating} variant="default" size="md">
          {isValidating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Connecting...
            </>
          ) : (
            'Connect'
          )}
        </Button>
      </div>
    </div>
  );
}
