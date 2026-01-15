'use client';

import { useState, useEffect } from 'react';
import { Loader2, Key } from 'lucide-react';
import { auth } from '@modelcontextprotocol/sdk/client/auth.js';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/ds/components/Dialog';
import { Button } from '@/ds/components/Button';
import { Txt } from '@/ds/components/Txt';
import { toast } from '@/lib/toast';

import { ProviderList } from './provider-list';
import { ToolkitBrowser } from './toolkit-browser';
import { ToolSelector } from './tool-selector';
import { MCPConnectionInput } from './mcp-connection-input';
import { SmitheryBrowser } from './smithery-browser';
import type { MCPConnectionConfig } from './mcp-connection-input';
import { useProviders, useProviderToolkits, useProviderTools, useIntegrationMutations, useOAuthCallback, useArcadeAuth } from '../hooks';
import { SmitheryBrowserOAuthProvider, storePendingOAuthState } from '../lib/smithery-oauth-provider';
import type { IntegrationProvider, ProviderToolkit } from '../types';
import type { ValidateMCPResponse, SmitheryServer, SmitheryServerConnection } from '@mastra/client-js';

/**
 * Props for the AddToolsDialog component.
 */
export interface AddToolsDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback to change the open state */
  onOpenChange: (open: boolean) => void;
  /** Optional callback called after successfully adding tools */
  onSuccess?: (integrationId: string) => void;
}

/**
 * Multi-step wizard dialog for adding integration tools to Mastra.
 *
 * Flow:
 * 1. Select Provider (Composio, Arcade)
 * 2. Select Toolkits from provider
 * 3. Review and deselect individual tools (all selected by default)
 * 4. Confirm and save integration
 *
 * @example
 * ```tsx
 * const [open, setOpen] = useState(false);
 *
 * <AddToolsDialog
 *   open={open}
 *   onOpenChange={setOpen}
 *   onSuccess={(id) => console.log(`Added integration ${id}`)}
 * />
 * ```
 */
export function AddToolsDialog({ open, onOpenChange, onSuccess }: AddToolsDialogProps) {
  // Wizard state
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedProvider, setSelectedProvider] = useState<IntegrationProvider | null>(null);
  const [selectedToolkits, setSelectedToolkits] = useState<Set<string>>(new Set());
  const [selectedToolkitNames, setSelectedToolkitNames] = useState<string[]>([]);
  const [deselectedTools, setDeselectedTools] = useState<Set<string>>(new Set());

  // MCP-specific state
  const [mcpConfig, setMcpConfig] = useState<MCPConnectionConfig | null>(null);
  const [mcpValidated, setMcpValidated] = useState(false);
  const [mcpToolCount, setMcpToolCount] = useState(0);
  const [mcpValidationError, setMcpValidationError] = useState<string | undefined>();

  // Smithery-specific state
  const [smitheryServer, setSmitheryServer] = useState<SmitheryServer | null>(null);
  const [smitheryConnection, setSmitheryConnection] = useState<SmitheryServerConnection | null>(null);
  const [smitheryValidated, setSmitheryValidated] = useState(false);
  const [smitheryOAuthProvider, setSmitheryOAuthProvider] = useState<SmitheryBrowserOAuthProvider | null>(null);
  const [smitheryValidating, setSmitheryValidating] = useState(false);
  const [smitheryValidationError, setSmitheryValidationError] = useState<string | undefined>();

  // Arcade-specific state for auth
  const [arcadeToolkitsRequiringOAuth, setArcadeToolkitsRequiringOAuth] = useState<ProviderToolkit[]>([]);
  const [arcadeToolkitsRequiringSecrets, setArcadeToolkitsRequiringSecrets] = useState<ProviderToolkit[]>([]);
  const [arcadeAuthPending, setArcadeAuthPending] = useState(false);
  const [showArcadeSecretsWarning, setShowArcadeSecretsWarning] = useState(false);

  // Arcade auth hook
  const {
    authState: arcadeAuthState,
    authorize: arcadeAuthorize,
    reset: resetArcadeAuth,
    isAuthorizing: isArcadeAuthorizing,
  } = useArcadeAuth({
    onSuccess: () => {
      toast.success('Successfully authorized');
      // After successful auth, move to step 3
      const names = toolkits
        .filter(t => selectedToolkits.has(t.slug))
        .map(t => t.name);
      setSelectedToolkitNames(names);
      setArcadeAuthPending(false);
      setStep(3);
    },
    onError: (error) => {
      toast.error(`Authorization failed: ${error}`);
      setArcadeAuthPending(false);
    },
  });

  // OAuth callback handling
  const { isReturningFromOAuth, authorizationCode, serverUrl: pendingServerUrl, clearOAuthState } = useOAuthCallback();

  // Determine if we're in MCP or Smithery mode
  const isMCPProvider = selectedProvider === 'mcp';
  const isSmitheryProvider = selectedProvider === 'smithery';

  // Data fetching
  const { data: providersResponse, isLoading: isLoadingProviders } = useProviders();
  const {
    data: toolkitsData,
    isLoading: isLoadingToolkits,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useProviderToolkits(selectedProvider || '', {
    params: {},
    enabled: !!selectedProvider && !isMCPProvider && step === 2,
  });
  // Build MCP/Smithery params for tools query
  const getMCPToolsParams = () => {
    // For direct MCP
    if (mcpConfig) {
      return mcpConfig.transport === 'http'
        ? { url: mcpConfig.url, headers: mcpConfig.headers ? JSON.stringify(mcpConfig.headers) : undefined }
        : {
            command: mcpConfig.command,
            args: mcpConfig.args ? JSON.stringify(mcpConfig.args) : undefined,
            env: mcpConfig.env ? JSON.stringify(mcpConfig.env) : undefined,
          };
    }
    // For Smithery, use the connection from Smithery server with OAuth tokens
    if (smitheryConnection && smitheryOAuthProvider) {
      const tokens = smitheryOAuthProvider.tokens();
      const headers = tokens?.access_token ? { Authorization: `Bearer ${tokens.access_token}` } : undefined;
      return smitheryConnection.type === 'http'
        ? { url: smitheryConnection.url, headers: headers ? JSON.stringify(headers) : undefined }
        : {
            command: smitheryConnection.command,
            args: smitheryConnection.args ? JSON.stringify(smitheryConnection.args) : undefined,
            env: smitheryConnection.env ? JSON.stringify(smitheryConnection.env) : undefined,
          };
    }
    return undefined;
  };

  const mcpToolsParams = getMCPToolsParams();

  // Determine which provider to use for tools fetch (smithery uses mcp under the hood)
  const toolsProvider = isSmitheryProvider ? 'mcp' : (selectedProvider || '');
  const isMCPLike = isMCPProvider || isSmitheryProvider;
  const isMCPLikeValidated = isMCPProvider ? mcpValidated : smitheryValidated;
  const hasMCPLikeConfig = isMCPProvider ? !!mcpConfig : !!smitheryConnection;

  const {
    data: toolsData,
    isLoading: isLoadingTools,
    fetchNextPage: fetchNextToolsPage,
    hasNextPage: hasNextToolsPage,
    isFetchingNextPage: isFetchingNextToolsPage,
  } = useProviderTools(toolsProvider, {
    params: isMCPLike
      ? mcpToolsParams
      : { toolkitSlugs: Array.from(selectedToolkits).join(',') },
    // For MCP/Smithery, require config to be set before enabling
    enabled: !!selectedProvider && (isMCPLike ? isMCPLikeValidated && hasMCPLikeConfig && step === 3 : selectedToolkits.size > 0 && step === 3),
  });

  // Mutations
  const { createIntegration, validateMCPConnection } = useIntegrationMutations();

  // Extract providers list from response
  const providers = providersResponse?.providers || [];

  // Flatten paginated data
  const toolkits = toolkitsData?.pages.flatMap(page => page.toolkits) || [];
  const tools = toolsData?.pages.flatMap(page => page.tools) || [];

  // Calculate selected tools (all tools from selected toolkits minus deselected)
  // Filter out any null/undefined slugs that may come from the API
  const selectedTools = new Set(
    tools
      .filter(tool => tool.slug && !deselectedTools.has(tool.slug))
      .map(tool => tool.slug)
  );

  // Smithery server selection handler - select and initialize OAuth provider
  const handleSmitheryServerSelect = async (server: SmitheryServer, connection?: SmitheryServerConnection) => {
    setSmitheryServer(server);
    setSmitheryConnection(connection || null);
    setSmitheryValidated(false);
    setSmitheryValidationError(undefined);

    if (!connection) {
      setSmitheryValidationError('Connection details not available for this server. Please try a different server or use MCP directly.');
      return;
    }

    // Initialize OAuth provider for HTTP connections
    if (connection.type === 'http' && connection.url) {
      const provider = new SmitheryBrowserOAuthProvider(connection.url);
      setSmitheryOAuthProvider(provider);

      // Check if we already have tokens (user authenticated previously)
      if (provider.hasTokens()) {
        // Try to validate with existing tokens
        handleSmitheryValidateWithProvider(connection, provider);
      }
    }
  };

  // Helper to validate with a specific OAuth provider
  const handleSmitheryValidateWithProvider = async (
    connection: SmitheryServerConnection,
    provider: SmitheryBrowserOAuthProvider
  ) => {
    setSmitheryValidating(true);
    setSmitheryValidationError(undefined);

    try {
      const tokens = provider.tokens();
      const headers = tokens?.access_token ? { Authorization: `Bearer ${tokens.access_token}` } : undefined;

      const validationParams = connection.type === 'http'
        ? { transport: 'http' as const, url: connection.url!, headers }
        : { transport: 'stdio' as const, command: connection.command!, args: connection.args, env: connection.env };

      const result = await validateMCPConnection.mutateAsync(validationParams) as ValidateMCPResponse;

      if (result.valid) {
        setSmitheryValidated(true);
        setMcpToolCount(result.toolCount);
      } else {
        const errorMsg = result.error || 'Unknown error';
        // Check if it's an auth error - need to re-authenticate
        if (errorMsg.includes('401') || errorMsg.includes('Unauthorized')) {
          // Clear invalid tokens and prompt for OAuth
          provider.clearState();
          setSmitheryValidationError('Authentication required. Click "Sign in with Smithery" to authenticate.');
        } else {
          setSmitheryValidationError(errorMsg);
        }
        setSmitheryValidated(false);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      if (errorMsg.includes('401') || errorMsg.includes('Unauthorized')) {
        provider.clearState();
        setSmitheryValidationError('Authentication required. Click "Sign in with Smithery" to authenticate.');
      } else {
        setSmitheryValidationError(errorMsg);
      }
      setSmitheryValidated(false);
    } finally {
      setSmitheryValidating(false);
    }
  };

  // Smithery OAuth handler - initiates OAuth flow
  const handleSmitheryOAuth = async () => {
    if (!smitheryConnection?.url || !smitheryOAuthProvider || !smitheryServer) return;

    setSmitheryValidating(true);
    setSmitheryValidationError(undefined);

    // Store server info before OAuth redirect so we can restore it after
    storePendingOAuthState({
      serverUrl: smitheryConnection.url,
      serverQualifiedName: smitheryServer.qualifiedName,
      serverDisplayName: smitheryServer.displayName,
      connectionType: smitheryConnection.type as 'http' | 'stdio',
    });

    try {
      // Use the MCP SDK's auth function to handle OAuth
      const result = await auth(smitheryOAuthProvider, {
        serverUrl: smitheryConnection.url,
      });

      if (result === 'AUTHORIZED') {
        // OAuth successful, validate the connection
        handleSmitheryValidateWithProvider(smitheryConnection, smitheryOAuthProvider);
      }
      // If result is 'REDIRECT', the user will be redirected to OAuth provider
      // and we'll handle the callback when they return
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setSmitheryValidationError(`OAuth error: ${errorMsg}`);
      setSmitheryValidating(false);
    }
  };

  // Listen for OAuth popup completion
  useEffect(() => {
    const handleOAuthMessage = async (event: MessageEvent) => {
      // Only accept messages from same origin
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === 'oauth_success' && event.data?.code) {
        const code = event.data.code;

        // Complete OAuth with the code
        if (smitheryOAuthProvider && smitheryConnection?.url) {
          setSmitheryValidating(true);
          try {
            const result = await auth(smitheryOAuthProvider, {
              serverUrl: smitheryConnection.url,
              authorizationCode: code,
            });

            if (result === 'AUTHORIZED') {
              toast.success('Successfully authenticated');
              // Now validate the connection with the tokens
              handleSmitheryValidateWithProvider(smitheryConnection, smitheryOAuthProvider);
            }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            setSmitheryValidationError(`Authentication failed: ${errorMsg}`);
            setSmitheryValidating(false);
          }
        }
      } else if (event.data?.type === 'oauth_error') {
        setSmitheryValidationError(`Authentication failed: ${event.data.error}`);
        setSmitheryValidating(false);
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, [smitheryOAuthProvider, smitheryConnection]);

  // Handle OAuth callback completion (fallback for redirect flow)
  useEffect(() => {
    if (isReturningFromOAuth && authorizationCode && pendingServerUrl) {
      // Reconstruct the OAuth provider and complete the flow
      const provider = new SmitheryBrowserOAuthProvider(pendingServerUrl);
      setSmitheryOAuthProvider(provider);

      // Set provider as Smithery and navigate to step 2
      setSelectedProvider('smithery');
      setStep(2);

      // Complete OAuth by calling auth again with the code
      const completeOAuth = async () => {
        setSmitheryValidating(true);
        try {
          const result = await auth(provider, {
            serverUrl: pendingServerUrl,
            authorizationCode,
          });

          if (result === 'AUTHORIZED') {
            clearOAuthState();
            toast.success('Successfully authenticated');
            // The server will be auto-selected based on the pending URL
            // For now, just show success - user can select the server again
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          setSmitheryValidationError(`OAuth completion failed: ${errorMsg}`);
          clearOAuthState();
        } finally {
          setSmitheryValidating(false);
        }
      };

      completeOAuth();
    }
  }, [isReturningFromOAuth, authorizationCode, pendingServerUrl, clearOAuthState]);

  // Smithery validation handler - tries without auth first, then prompts for OAuth
  const handleSmitheryValidate = async () => {
    if (!smitheryConnection) return;

    // For stdio connections, just validate directly
    if (smitheryConnection.type !== 'http') {
      setSmitheryValidating(true);
      setSmitheryValidationError(undefined);

      try {
        const validationParams = {
          transport: 'stdio' as const,
          command: smitheryConnection.command!,
          args: smitheryConnection.args,
          env: smitheryConnection.env
        };

        const result = await validateMCPConnection.mutateAsync(validationParams) as ValidateMCPResponse;

        if (result.valid) {
          setSmitheryValidated(true);
          setMcpToolCount(result.toolCount);
        } else {
          setSmitheryValidationError(result.error || 'Unknown error');
          setSmitheryValidated(false);
        }
      } catch (error) {
        setSmitheryValidationError(error instanceof Error ? error.message : 'Unknown error');
        setSmitheryValidated(false);
      } finally {
        setSmitheryValidating(false);
      }
      return;
    }

    // For HTTP connections, use OAuth provider
    if (smitheryOAuthProvider) {
      if (smitheryOAuthProvider.hasTokens()) {
        // Already have tokens, validate with them
        handleSmitheryValidateWithProvider(smitheryConnection, smitheryOAuthProvider);
      } else {
        // No tokens, start OAuth flow
        handleSmitheryOAuth();
      }
    }
  };

  // MCP validation handler
  const handleMCPValidate = async (config: MCPConnectionConfig) => {
    setMcpValidationError(undefined);
    setMcpValidated(false);

    // Build validation params based on transport
    const validationParams = config.transport === 'http'
      ? { transport: 'http' as const, url: config.url!, headers: config.headers }
      : { transport: 'stdio' as const, command: config.command!, args: config.args, env: config.env };

    const result = await validateMCPConnection.mutateAsync(validationParams) as ValidateMCPResponse;

    if (!result.valid) {
      setMcpValidationError(result.error || 'Failed to connect to MCP server');
      throw new Error(result.error || 'Failed to connect to MCP server');
    }

    // Store MCP config and mark as validated
    setMcpConfig(config);
    setMcpValidated(true);
    setMcpToolCount(result.toolCount);
  };

  // Check if Arcade provider
  const isArcadeProvider = selectedProvider === 'arcade';

  // Navigation handlers
  const handleNext = () => {
    if (step === 1 && selectedProvider) {
      // For MCP, we show URL input in step 1, then skip step 2 when validated
      if (isMCPProvider) {
        if (mcpValidated) {
          // Set virtual toolkit for MCP and skip to step 3
          setSelectedToolkits(new Set(['mcp-server']));
          setStep(3);
        }
        // If not validated, user needs to connect first - don't navigate
      } else if (isSmitheryProvider) {
        // For Smithery, step 2 is the server browser
        setStep(2);
      } else {
        setStep(2);
      }
    } else if (step === 2) {
      if (isSmitheryProvider && smitheryValidated) {
        // Smithery: server selected and validated, go to tools
        setSelectedToolkits(new Set(['mcp-server']));
        setStep(3);
      } else if (selectedToolkits.size > 0) {
        // For Arcade, check if any selected toolkits require auth
        if (isArcadeProvider) {
          const selectedToolkitsList = toolkits.filter(t => selectedToolkits.has(t.slug));

          // Separate OAuth and secret-based toolkits
          const oauthToolkits = selectedToolkitsList.filter(t => t.metadata?.authType === 'oauth');
          const secretToolkits = selectedToolkitsList.filter(t => t.metadata?.authType === 'secret');

          setArcadeToolkitsRequiringOAuth(oauthToolkits);
          setArcadeToolkitsRequiringSecrets(secretToolkits);

          // If there are secret-based toolkits, show warning but allow proceeding
          if (secretToolkits.length > 0) {
            setShowArcadeSecretsWarning(true);
          }

          // If there are OAuth toolkits, start auth flow
          if (oauthToolkits.length > 0) {
            const firstToolkit = oauthToolkits[0];
            if (firstToolkit?.slug) {
              setArcadeAuthPending(true);
              // Start authorization for the first OAuth toolkit
              arcadeAuthorize(firstToolkit.slug);
              return;
            }
          }
        }

        // Store the selected toolkit names before moving to step 3
        // (toolkits data won't be available in step 3 since the query is disabled)
        const names = toolkits
          .filter(t => selectedToolkits.has(t.slug))
          .map(t => t.name);
        setSelectedToolkitNames(names);
        setStep(3);
      }
    }
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
      // Reset Smithery state when going back from server browser
      if (isSmitheryProvider) {
        setSmitheryServer(null);
        setSmitheryConnection(null);
        setSmitheryValidated(false);
      }
    } else if (step === 3) {
      if (isMCPProvider) {
        // For MCP, go back to step 1 (URL input)
        setStep(1);
      } else if (isSmitheryProvider) {
        // For Smithery, go back to step 2 (server browser)
        setStep(2);
        setSmitheryValidated(false);
      } else {
        setStep(2);
      }
    }
  };

  const handleCancel = () => {
    // Reset wizard state
    setStep(1);
    setSelectedProvider(null);
    setSelectedToolkits(new Set());
    setDeselectedTools(new Set());
    // Reset MCP state
    setMcpConfig(null);
    setMcpValidated(false);
    setMcpToolCount(0);
    setMcpValidationError(undefined);
    // Reset Smithery state
    setSmitheryServer(null);
    setSmitheryConnection(null);
    setSmitheryValidated(false);
    setSmitheryOAuthProvider(null);
    setSmitheryValidationError(undefined);
    // Reset Arcade auth state
    setArcadeToolkitsRequiringOAuth([]);
    setArcadeToolkitsRequiringSecrets([]);
    setArcadeAuthPending(false);
    setShowArcadeSecretsWarning(false);
    resetArcadeAuth();
    onOpenChange(false);
  };

  const handleConfirm = async () => {
    if (!selectedProvider || selectedToolkits.size === 0) {
      return;
    }

    try {
      const integrationId = crypto.randomUUID();

      // Generate integration name based on provider and config
      let integrationName: string;
      if (isSmitheryProvider && smitheryServer) {
        // Use Smithery server display name
        integrationName = smitheryServer.displayName;
      } else if (isMCPProvider && mcpConfig) {
        // Use custom name if provided, otherwise generate from connection info
        if (mcpConfig.name) {
          integrationName = mcpConfig.name;
        } else if (mcpConfig.transport === 'http') {
          integrationName = `MCP: ${new URL(mcpConfig.url!).hostname}`;
        } else {
          integrationName = `MCP: ${mcpConfig.command}`;
        }
      } else {
        // For Composio/Arcade, use the stored toolkit names
        if (selectedToolkitNames.length > 0) {
          integrationName = selectedToolkitNames.join(', ');
        } else {
          // Fallback to slugs if names not available
          integrationName = Array.from(selectedToolkits).join(', ') || `${selectedProvider} Integration`;
        }
      }

      // Filter out any null/undefined values that may have been added to the Sets
      const toolkitsArray = Array.from(selectedToolkits).filter((slug): slug is string => Boolean(slug));
      const toolsArray = Array.from(selectedTools).filter((slug): slug is string => Boolean(slug));

      // Build metadata based on provider type
      let integrationMetadata: Record<string, unknown> | undefined;

      if (isSmitheryProvider && smitheryServer && smitheryConnection) {
        // Smithery integration with MCP connection details
        // Use OAuth tokens from the provider for authentication
        const tokens = smitheryOAuthProvider?.tokens();
        const authHeaders = tokens?.access_token ? { Authorization: `Bearer ${tokens.access_token}` } : undefined;
        integrationMetadata = {
          smitheryQualifiedName: smitheryServer.qualifiedName,
          smitheryDisplayName: smitheryServer.displayName,
          verified: smitheryServer.verified,
          transport: smitheryConnection.type,
          ...(smitheryConnection.type === 'http'
            ? { url: smitheryConnection.url, headers: authHeaders }
            : {
                command: smitheryConnection.command,
                args: smitheryConnection.args,
                env: smitheryConnection.env,
              }),
        };
      } else if (isMCPProvider && mcpConfig) {
        // Direct MCP integration
        integrationMetadata = mcpConfig.transport === 'http'
          ? {
              transport: 'http' as const,
              url: mcpConfig.url,
              headers: mcpConfig.headers,
            }
          : {
              transport: 'stdio' as const,
              command: mcpConfig.command,
              args: mcpConfig.args,
              env: mcpConfig.env,
            };
      }

      await createIntegration.mutateAsync({
        id: integrationId,
        provider: selectedProvider,
        name: integrationName,
        enabled: true,
        selectedToolkits: toolkitsArray,
        selectedTools: toolsArray,
        // Include metadata if this is an MCP/Smithery integration
        ...(integrationMetadata && { metadata: integrationMetadata }),
      });

      const providerLabel = isSmitheryProvider ? 'Smithery server' : (isMCPProvider ? 'MCP server' : selectedProvider);
      toast.success(`Successfully added ${selectedTools.size} tools from ${providerLabel}`);
      handleCancel(); // Reset and close
      onSuccess?.(integrationId);
    } catch (error) {
      toast.error(
        `Failed to add integration: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  };

  const handleProviderSelect = (provider: string) => {
    setSelectedProvider(provider as IntegrationProvider);
    // Reset MCP state when changing provider
    if (provider !== 'mcp') {
      setMcpConfig(null);
      setMcpValidated(false);
      setMcpToolCount(0);
      setMcpValidationError(undefined);
    }
    // Reset Smithery state when changing provider
    if (provider !== 'smithery') {
      setSmitheryServer(null);
      setSmitheryConnection(null);
      setSmitheryValidated(false);
      setSmitheryOAuthProvider(null);
      setSmitheryValidationError(undefined);
    }
  };

  const handleToolkitSelectionChange = (newSelection: Set<string>) => {
    setSelectedToolkits(newSelection);
  };

  const handleToolSelectionChange = (newSelection: Set<string>) => {
    // Convert from "selected" to "deselected" - tool selector shows selected, we track deselected
    const allToolSlugs = new Set(tools.map(t => t.slug));
    const newDeselected = new Set<string>();
    for (const slug of allToolSlugs) {
      if (!newSelection.has(slug)) {
        newDeselected.add(slug);
      }
    }
    setDeselectedTools(newDeselected);
  };

  // Determine button states
  const canGoNext = step === 1
    ? (isMCPProvider ? mcpValidated : !!selectedProvider)
    : step === 2
    ? (isSmitheryProvider ? smitheryValidated : selectedToolkits.size > 0 && !arcadeAuthPending)
    : false;
  const isLastStep = step === 3;

  // Get step subtitle
  const getStepSubtitle = () => {
    if (step === 1) {
      if (isMCPProvider) {
        return 'Configure MCP server connection';
      }
      return 'Select an integration provider';
    }
    if (step === 2) {
      if (isSmitheryProvider) {
        return 'Browse and select an MCP server from Smithery';
      }
      return `Select toolkits from ${selectedProvider}`;
    }
    return 'Review and customize tool selection';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface1 border-border1 max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Tools</DialogTitle>
          <Txt variant="ui-sm" className="text-icon6">
            {getStepSubtitle()}
          </Txt>
        </DialogHeader>

        {/* Step indicator - MCP has 2 steps (provider/URL, tools), Smithery has 3 (provider, server browser, tools), others have 3 (provider, toolkits, tools) */}
        <div className="flex items-center gap-2 pb-4">
          <div
            className={`flex-1 h-1 rounded-full ${
              step >= 1 ? 'bg-accent1' : 'bg-surface3'
            }`}
          />
          {(!isMCPProvider || isSmitheryProvider) && (
            <div
              className={`flex-1 h-1 rounded-full ${
                step >= 2 ? 'bg-accent1' : 'bg-surface3'
              }`}
            />
          )}
          <div
            className={`flex-1 h-1 rounded-full ${
              step >= 3 || (isMCPProvider && step >= 1 && mcpValidated) ? 'bg-accent1' : 'bg-surface3'
            }`}
          />
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto min-h-[400px]">
          {step === 1 && !isMCPProvider && (
            <ProviderList
              providers={providers}
              isLoading={isLoadingProviders}
              selectedProvider={selectedProvider || undefined}
              onSelectProvider={handleProviderSelect}
            />
          )}

          {step === 1 && isMCPProvider && (
            <div className="space-y-4">
              {/* Back to provider selection */}
              <button
                type="button"
                onClick={() => setSelectedProvider(null)}
                className="text-icon5 hover:text-icon6 text-sm flex items-center gap-1"
              >
                ← Back to providers
              </button>

              <MCPConnectionInput
                onValidate={handleMCPValidate}
                isValidating={validateMCPConnection.isPending}
                validationError={mcpValidationError}
                onSuccess={(config, toolCount) => {
                  setMcpConfig(config);
                  setMcpToolCount(toolCount);
                  setMcpValidated(true);
                }}
              />

              {mcpValidated && mcpConfig && (
                <div className="bg-surface3 rounded-lg p-4 space-y-2">
                  <Txt variant="ui-sm" className="text-icon6 font-medium">
                    Connection Verified
                  </Txt>
                  <Txt variant="ui-sm" className="text-icon3">
                    Found {mcpToolCount} tool{mcpToolCount === 1 ? '' : 's'} available
                    {mcpConfig.transport === 'http' ? ` on ${mcpConfig.url}` : ` via ${mcpConfig.command}`}.
                    Click Next to review and select tools.
                  </Txt>
                </div>
              )}
            </div>
          )}

          {step === 2 && selectedProvider && isSmitheryProvider && (
            <div className="space-y-4">
              <SmitheryBrowser
                selectedServer={smitheryServer?.qualifiedName}
                onServerSelect={handleSmitheryServerSelect}
              />

              {/* OAuth authentication - shown when server is selected but not validated */}
              {smitheryServer && smitheryConnection && !smitheryValidated && (
                <div className="bg-surface3 rounded-lg p-4 space-y-3">
                  <div>
                    <Txt variant="ui-sm" className="text-icon6 font-medium">
                      {smitheryServer.displayName} selected
                    </Txt>
                    {smitheryConnection.type === 'http' ? (
                      <Txt variant="ui-xs" className="text-icon3 mt-1">
                        This server requires authentication. You'll be redirected to authorize access with the service provider.
                      </Txt>
                    ) : (
                      <Txt variant="ui-xs" className="text-icon3 mt-1">
                        Click below to connect to this server.
                      </Txt>
                    )}
                  </div>

                  {smitheryValidationError && (
                    <div className="bg-destructive1/10 border border-destructive1/30 rounded p-2">
                      <Txt variant="ui-xs" className="text-destructive1">
                        {smitheryValidationError}
                      </Txt>
                    </div>
                  )}

                  <Button
                    variant="default"
                    size="md"
                    onClick={handleSmitheryValidate}
                    disabled={smitheryValidating}
                  >
                    {smitheryValidating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {smitheryConnection.type === 'http' ? 'Authorizing...' : 'Connecting...'}
                      </>
                    ) : smitheryConnection.type === 'http' && !smitheryOAuthProvider?.hasTokens() ? (
                      'Authorize Connection'
                    ) : (
                      'Connect to Server'
                    )}
                  </Button>
                </div>
              )}

              {/* Connection error when no connection details */}
              {smitheryServer && !smitheryConnection && smitheryValidationError && (
                <div className="bg-destructive1/10 border border-destructive1/30 rounded-lg p-4">
                  <Txt variant="ui-sm" className="text-destructive1">
                    {smitheryValidationError}
                  </Txt>
                </div>
              )}

              {smitheryValidated && smitheryServer && (
                <div className="bg-surface3 rounded-lg p-4 space-y-2">
                  <Txt variant="ui-sm" className="text-icon6 font-medium">
                    Server Connected
                  </Txt>
                  <Txt variant="ui-sm" className="text-icon3">
                    Found {mcpToolCount} tool{mcpToolCount === 1 ? '' : 's'} available on {smitheryServer.displayName}.
                    Click Next to review and select tools.
                  </Txt>
                </div>
              )}
            </div>
          )}

          {step === 2 && selectedProvider && !isMCPProvider && !isSmitheryProvider && (
            <div className="relative">
              <ToolkitBrowser
                toolkits={toolkits}
                isLoading={isLoadingToolkits}
                loadingMessage={
                  selectedProvider === 'arcade'
                    ? "Gathering all of Arcade's available tools... this may take a minute."
                    : undefined
                }
                selectedToolkits={selectedToolkits}
                onSelectionChange={handleToolkitSelectionChange}
                hasMore={hasNextPage}
                onLoadMore={fetchNextPage}
                isLoadingMore={isFetchingNextPage}
              />

              {/* Arcade authorization overlay */}
              {arcadeAuthPending && (
                <div className="absolute inset-0 bg-surface1/90 flex items-center justify-center z-10">
                  <div className="bg-surface3 rounded-lg p-6 max-w-md text-center space-y-4 shadow-lg border border-border1">
                    {isArcadeAuthorizing ? (
                      <>
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-accent1" />
                        <div className="space-y-2">
                          <Txt variant="ui-md" className="text-icon6 font-medium">
                            Authorizing {arcadeToolkitsRequiringOAuth[0]?.name || 'toolkit'}
                          </Txt>
                          <Txt variant="ui-sm" className="text-icon3">
                            {arcadeAuthState.authorizationUrl
                              ? 'Complete authorization in the popup window...'
                              : 'Initiating authorization...'}
                          </Txt>
                        </div>
                        {arcadeAuthState.authorizationUrl && (
                          <div className="pt-2">
                            <Button
                              variant="outline"
                              size="md"
                              onClick={() => window.open(arcadeAuthState.authorizationUrl, '_blank')}
                            >
                              Reopen Authorization Window
                            </Button>
                          </div>
                        )}
                      </>
                    ) : arcadeAuthState.status === 'failed' ? (
                      <>
                        <div className="h-8 w-8 mx-auto rounded-full bg-destructive1/10 flex items-center justify-center">
                          <Txt variant="ui-lg" className="text-destructive1">✕</Txt>
                        </div>
                        <div className="space-y-2">
                          <Txt variant="ui-md" className="text-icon6 font-medium">
                            Authorization Failed
                          </Txt>
                          <Txt variant="ui-sm" className="text-destructive1">
                            {arcadeAuthState.error || 'Unable to authorize. Please try again.'}
                          </Txt>
                        </div>
                        <div className="flex gap-2 justify-center pt-2">
                          <Button
                            variant="outline"
                            size="md"
                            onClick={() => {
                              setArcadeAuthPending(false);
                              resetArcadeAuth();
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="default"
                            size="md"
                            onClick={() => {
                              const firstToolkit = arcadeToolkitsRequiringOAuth[0];
                              if (firstToolkit?.slug) {
                                arcadeAuthorize(firstToolkit.slug);
                              }
                            }}
                          >
                            Try Again
                          </Button>
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              )}

              {/* Arcade API key warning banner */}
              {showArcadeSecretsWarning && arcadeToolkitsRequiringSecrets.length > 0 && !arcadeAuthPending && (
                <div className="absolute inset-0 bg-surface1/90 flex items-center justify-center z-10">
                  <div className="bg-surface3 rounded-lg p-6 max-w-lg text-center space-y-4 shadow-lg border border-border1">
                    <div className="h-10 w-10 mx-auto rounded-full bg-warning1/10 flex items-center justify-center">
                      <Key className="h-5 w-5 text-warning1" />
                    </div>
                    <div className="space-y-2">
                      <Txt variant="ui-md" className="text-icon6 font-medium">
                        API Keys Required
                      </Txt>
                      <Txt variant="ui-sm" className="text-icon3">
                        The following toolkits require API keys to be configured in your{' '}
                        <a
                          href="https://arcade.dev/dashboard"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent1 hover:underline"
                        >
                          Arcade dashboard
                        </a>
                        :
                      </Txt>
                      <div className="bg-surface2 rounded p-3 mt-2 text-left max-h-32 overflow-y-auto">
                        {arcadeToolkitsRequiringSecrets.map(toolkit => (
                          <div key={toolkit.slug} className="flex items-center justify-between py-1">
                            <Txt variant="ui-sm" className="text-icon6">{toolkit.name}</Txt>
                            <Txt variant="ui-xs" className="text-icon3 font-mono">
                              {(toolkit.metadata?.secretKey as string) || 'API_KEY'}
                            </Txt>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2 justify-center pt-2">
                      <Button
                        variant="outline"
                        size="md"
                        onClick={() => setShowArcadeSecretsWarning(false)}
                      >
                        Go Back
                      </Button>
                      <Button
                        variant="default"
                        size="md"
                        onClick={() => {
                          setShowArcadeSecretsWarning(false);
                          // Proceed to step 3
                          const names = toolkits
                            .filter(t => selectedToolkits.has(t.slug))
                            .map(t => t.name);
                          setSelectedToolkitNames(names);
                          setStep(3);
                        }}
                      >
                        Continue Anyway
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && selectedProvider && (
            <ToolSelector
              tools={tools}
              isLoading={isLoadingTools}
              selectedTools={selectedTools}
              onSelectionChange={handleToolSelectionChange}
            />
          )}
        </div>

        {/* Footer with navigation */}
        <DialogFooter className="flex flex-row items-center justify-between gap-2 pt-4 border-t border-border1">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="md" onClick={handleCancel}>
              Cancel
            </Button>
            {step > 1 && (
              <Button variant="outline" size="md" onClick={handleBack}>
                Back
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step === 2 && !isSmitheryProvider && selectedToolkits.size > 0 && (
              <Txt variant="ui-sm" className="text-icon6">
                {selectedToolkits.size} toolkit{selectedToolkits.size === 1 ? '' : 's'} selected
              </Txt>
            )}
            {step === 2 && isSmitheryProvider && smitheryValidated && smitheryServer && (
              <Txt variant="ui-sm" className="text-icon6">
                {smitheryServer.displayName} selected
              </Txt>
            )}
            {step === 3 && (
              <Txt variant="ui-sm" className="text-icon6">
                {selectedTools.size} tool{selectedTools.size === 1 ? '' : 's'} selected
              </Txt>
            )}

            {!isLastStep ? (
              <Button
                variant="default"
                size="md"
                onClick={handleNext}
                disabled={!canGoNext}
              >
                Next
              </Button>
            ) : (
              <Button
                variant="default"
                size="md"
                onClick={handleConfirm}
                disabled={selectedTools.size === 0 || createIntegration.isPending}
              >
                {createIntegration.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  `Add ${selectedTools.size} Tool${selectedTools.size === 1 ? '' : 's'}`
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
