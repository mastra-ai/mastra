import { useQuery, useMutation } from '@tanstack/react-query';
import { TemplateInstallationRequest } from '@mastra/client-js';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { client } from '@/lib/client';
import { useState } from 'react';

export interface Template {
  slug: string;
  title: string;
  description: string;
  longDescription: string;
  githubUrl: string;
  tags: string[];
  imageURL?: string;
  codeExample?: string;
  agents?: string[];
  tools?: string[];
  workflows?: string[];
  mcp?: string[];
  networks?: string[];
  videoURL?: string;
  useCase: string;
  supportedProviders: string[];
}

async function getMastraTemplateRepos(): Promise<{ templates: Template[]; tags: string[]; providers: string[] }> {
  const response = await fetch('https://mastra.ai/api/templates.json');
  if (!response.ok) {
    throw new Error(`Failed to fetch templates: ${response.statusText}`);
  }
  const templates = await response.json();
  const allTemplates = [
    {
      title: 'Weather Agent',
      slug: 'weather-agent',
      githubUrl: 'https://github.com/mastra-ai/weather-agent',
      description: 'Get weather information of any city.',
      longDescription: 'One Agent, one Workflow and one Tool to bring you the weather in your city.',
      imageURL: '',
      tags: ['Agent', 'Workflow', 'Tool'],
      useCase: '',
      supportedProviders: ['openai', 'anthropic', 'google', 'groq'],
      agents: ['weatherAgent'],
      tools: ['weatherTool'],
      workflows: ['weatherWorkflow'],
    },
    ...templates,
  ];

  const allTags = Array.from(new Set(allTemplates.flatMap(t => t.tags)));
  const allProviders = Array.from(new Set(allTemplates.flatMap(t => t.supportedProviders)));

  return {
    templates: allTemplates,
    tags: allTags,
    providers: allProviders,
  };
}

async function getTemplateRepoByRepoName({ repo, owner }: { repo: string; owner: string }): Promise<Template> {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch template: ${response.statusText}`);
  }
  const repoInfo = await response.json();
  if (!repoInfo.is_template) {
    throw new Error('Repo is not a template, please update the repo settings to make it a template');
  }

  return {
    title: repoInfo.name,
    slug: repoInfo.name,
    description: repoInfo.description ?? '',
    imageURL: '',
    tags: [],
    useCase: '',
    longDescription: repoInfo.description ?? '',
    githubUrl: repoInfo.html_url,
    supportedProviders: [],
  };
}

async function getTemplateRepo({ repoOrSlug, owner }: { repoOrSlug: string; owner: string }): Promise<Template> {
  const { templates } = await getMastraTemplateRepos();
  const template = templates.find(t => t.slug === repoOrSlug);

  if (!template) {
    if (owner === 'mastra-ai' && repoOrSlug.startsWith('template-')) {
      const templateRepo = templates.find(template => `template-${template.slug}` === repoOrSlug);
      if (templateRepo) {
        return templateRepo;
      }
    }

    const templateRepo = await getTemplateRepoByRepoName({ repo: repoOrSlug, owner });

    if (templateRepo) {
      return templateRepo;
    }

    throw new Error(`Template ${repoOrSlug} not found`);
  }

  return template;
}

async function getTemplateRepoEnvVars({
  repo,
  owner,
  branch,
}: {
  repo: string;
  owner: string;
  branch: string;
}): Promise<Record<string, string>> {
  const envUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/.env.example`;
  const envResponse = await fetch(envUrl);

  if (envResponse.ok) {
    const envContent = await envResponse.text();
    const envVars = envContent.split('\n').reduce(
      (acc, line) => {
        if (!line || line.startsWith('#')) return acc; // Skip empty lines and comments

        const [key, value] = line.split('=');

        if (key) {
          acc[key] = value?.split('')?.every(item => item === '*') ? '' : value?.replaceAll('"', '');
        }
        return acc;
      },
      {} as Record<string, string>,
    );

    return envVars;
  }

  return {};
}

export const useMastraTemplates = () => {
  return useQuery({
    queryKey: ['mastra-templates'],
    queryFn: getMastraTemplateRepos,
  });
};

export const useTemplateRepo = ({ repoOrSlug, owner }: { repoOrSlug: string; owner: string }) => {
  return useQuery({
    queryKey: ['template-repo', repoOrSlug, owner],
    queryFn: () => getTemplateRepo({ repoOrSlug, owner }),
  });
};

export const useTemplateRepoEnvVars = ({ repo, owner, branch }: { repo: string; owner: string; branch: string }) => {
  return useQuery({
    queryKey: ['template-repo-env-vars', repo, owner, branch],
    queryFn: () => getTemplateRepoEnvVars({ repo, owner, branch }),
  });
};

export const useAgentBuilderWorkflow = () => {
  return useQuery({
    queryKey: ['agent-builder-workflow'],
    queryFn: async () => {
      const template = client.getAgentBuilderAction('merge-template');
      return await template.details();
    },
  });
};

export const useCreateTemplateInstallRun = () => {
  return useMutation({
    mutationFn: async ({ runId }: { runId?: string }) => {
      const template = client.getAgentBuilderAction('merge-template');
      return await template.createRun({ runId });
    },
  });
};

export const useGetTemplateInstallRun = () => {
  return useMutation({
    mutationFn: async ({ runId }: { runId: string }) => {
      const template = client.getAgentBuilderAction('merge-template');
      return await template.runById(runId);
    },
  });
};

// Helper function to process template installation records (like workflows' sanitizeWorkflowWatchResult)
const processTemplateInstallRecord = (
  record: { type: string; payload: any; runId?: string; eventTimestamp?: string },
  currentState: any,
  workflowInfo?: any,
): { newState: any } => {
  let newState = { ...currentState };

  // Initialize steps if not present or empty
  const hasSteps =
    newState.payload?.workflowState?.steps && Object.keys(newState.payload.workflowState.steps).length > 0;
  if (!hasSteps && workflowInfo?.allSteps) {
    newState.payload = {
      ...newState.payload,
      workflowState: {
        ...newState.payload?.workflowState,
        steps: Object.keys(workflowInfo.allSteps).reduce((acc, stepId) => {
          acc[stepId] = {
            id: stepId,
            description: workflowInfo.allSteps[stepId].description,
            status: 'pending',
          };
          return acc;
        }, {} as any),
      },
    };
  }

  // Handle different event types
  if (record.type === 'start') {
    // Pre-populate all workflow steps from workflowInfo if available
    const initialSteps: any = {};
    if (workflowInfo?.allSteps) {
      Object.entries(workflowInfo.allSteps).forEach(([stepId, stepData]: [string, any]) => {
        initialSteps[stepId] = {
          id: stepData.id,
          description: stepData.description,
          status: 'pending',
        };
      });
    }

    newState = {
      ...newState,
      runId: record.payload.runId,
      eventTimestamp: new Date().toISOString(),
      status: 'running',
      phase: 'initializing',
      payload: {
        workflowState: {
          status: 'running',
          steps: initialSteps,
        },
        currentStep: null,
      },
    };
  }

  if (record.type === 'step-start') {
    const stepId = record.payload.id;
    newState = {
      ...newState,
      phase: 'processing',
      payload: {
        ...newState.payload,
        currentStep: {
          id: stepId,
          status: 'running',
          startTime: new Date(),
          ...record.payload,
        },
        workflowState: {
          ...newState.payload.workflowState,
          steps: {
            ...newState.payload.workflowState.steps,
            [stepId]: {
              ...newState.payload.workflowState.steps[stepId],
              status: 'running',
              startTime: new Date(),
              ...record.payload,
            },
          },
        },
      },
    };
  }

  if (record.type === 'step-result') {
    const stepId = record.payload.id;
    const status = record.payload.status;
    const hasError = record.payload.error;
    newState = {
      ...newState,
      payload: {
        ...newState.payload,
        currentStep: {
          ...newState.payload.currentStep,
          status: record.payload.status,
          output: record.payload.output,
          error: record.payload.error,
          endTime: new Date(),
        },
        workflowState: {
          ...newState.payload.workflowState,
          steps: {
            ...newState.payload.workflowState.steps,
            [stepId]: {
              ...newState.payload.workflowState.steps[stepId],
              status: record.payload.status,
              output: record.payload.output,
              error: record.payload.error,
              endTime: new Date(),
            },
          },
        },
      },
    };

    // If this step failed, also set workflow-level error state
    if (status === 'failed' && hasError) {
      newState = {
        ...newState,
        status: 'failed',
        error: hasError,
        phase: 'error',
        failedStep: {
          id: stepId,
          error: hasError,
          description: record.payload.description || stepId,
        },
        payload: {
          ...newState.payload,
          workflowState: {
            ...newState.payload.workflowState,
            status: 'failed',
          },
        },
        errorTimestamp: new Date(),
      };
    }
  }

  if (record.type === 'step-finish') {
    newState = {
      ...newState,
      payload: {
        ...newState.payload,
        currentStep: null,
      },
    };
  }

  if (record.type === 'finish') {
    // Don't override error states - if we're already in error phase, stay there
    if (newState.phase === 'error' || newState.status === 'failed') {
      newState = {
        ...newState,
        // Keep existing status, phase, error, failedStep
        completedAt: new Date(),
      };
    } else {
      // Normal completion flow
      newState = {
        ...newState,
        status: record.payload.status || 'completed',
        phase: 'completed',
        payload: {
          ...newState.payload,
          currentStep: null,
          workflowState: {
            ...newState.payload.workflowState,
            status: record.payload.status || 'completed',
          },
        },
        completedAt: new Date(),
      };
    }
  }

  if (record.type === 'error') {
    newState = {
      ...newState,
      status: 'failed',
      error: record.payload.error,
      phase: 'error',
      payload: {
        ...newState.payload,
        workflowState: {
          ...newState.payload.workflowState,
          status: 'failed',
        },
      },
      errorTimestamp: new Date(),
    };
  }

  return { newState };
};

// Shared localStorage helpers for template installation state
const saveTemplateStateToLocalStorage = (runId: string, state: any) => {
  try {
    localStorage.setItem(
      `template-install-${runId}`,
      JSON.stringify({
        state,
        timestamp: Date.now(),
      }),
    );
  } catch (error) {
    console.warn('Failed to save template state to localStorage:', error);
  }
};

const restoreTemplateStateFromLocalStorage = (runId: string) => {
  try {
    const key = `template-install-${runId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      const { state, timestamp } = JSON.parse(saved);
      const age = Date.now() - timestamp;
      const maxAge = 60 * 60 * 1000; // 1 hour
      // Only restore if saved within last hour (prevent stale data)
      if (age < maxAge) {
        return state;
      } else {
        localStorage.removeItem(key);
      }
    }
  } catch (error) {
    console.warn('Failed to restore template state from localStorage:', error);
  }
  return null;
};

export const useWatchTemplateInstall = (workflowInfo?: any) => {
  const [streamResult, setStreamResult] = useState<any>({});

  // Use debouncing like workflows (prevents excessive re-renders)
  // Process each record immediately - no debouncing for watch events
  // (Watch events are already discrete and we can't afford to lose step completion events)
  const processTemplateRecord = (record: { type: string; payload: any; runId?: string; eventTimestamp?: string }) => {
    setStreamResult((currentState: any) => {
      const { newState } = processTemplateInstallRecord(record, currentState, workflowInfo);

      // Save to localStorage for refresh recovery
      if (record.runId) {
        saveTemplateStateToLocalStorage(record.runId, newState);
      }

      return newState;
    });
  };

  const initializeState = async (runId: string) => {
    // 1. Instantly restore from localStorage for immediate UI
    const cachedState = restoreTemplateStateFromLocalStorage(runId);
    if (cachedState) {
      setStreamResult(cachedState);
    } else {
      // Fallback: Initialize with pending steps
      setStreamResult({
        runId,
        eventTimestamp: new Date().toISOString(),
        phase: 'running',
        payload: {
          workflowState: {
            steps: workflowInfo?.allSteps
              ? Object.keys(workflowInfo.allSteps).reduce((acc, stepId) => {
                  acc[stepId] = {
                    id: stepId,
                    description: workflowInfo.allSteps[stepId].description,
                    status: 'pending',
                  };
                  return acc;
                }, {} as any)
              : {},
          },
          currentStep: null,
        },
      });
    }
  };

  const watchInstall = useMutation({
    mutationFn: async ({ runId }: { runId: string }) => {
      const maxRetries = 3;
      const retryDelay = 2000; // 2 seconds

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // Initialize state with hybrid approach
          await initializeState(runId);

          const template = client.getAgentBuilderAction('merge-template');

          // Use correct callback API (fix the TypeScript issue when possible)
          await template.watch(
            { runId, eventType: 'watch-v2' },
            (record: { type: string; payload: any; runId?: string; eventTimestamp?: string }) => {
              try {
                processTemplateRecord(record);
              } catch (err) {
                console.error('💥 [watchInstall] Error processing template record:', err);
                // Set minimal error state if processing fails (graceful degradation)
                setStreamResult((prev: any) => ({ ...prev, error: err }));
              }
            },
          );

          // If we get here, the watch completed successfully
          return;
        } catch (error: any) {
          console.error(`💥 [watchInstall] Attempt ${attempt} failed:`, error);
          const isNetworkError =
            error?.message?.includes('Failed to fetch') ||
            error?.message?.includes('NetworkError') ||
            error?.message?.includes('network error') ||
            error?.message?.includes('fetch') ||
            error?.code === 'NETWORK_ERROR' ||
            error?.name === 'TypeError';

          console.warn(`Watch attempt ${attempt}/${maxRetries} failed:`, error);

          if (isNetworkError && attempt < maxRetries) {
            console.log(
              `🔄 Watch network error detected (likely hot reload), retrying in ${retryDelay}ms... (attempt ${attempt + 1}/${maxRetries})`,
            );
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue; // Retry
          }

          // If it's not a network error or we've exhausted retries, throw
          console.error('❌ [watchInstall] Non-network error or max retries reached, throwing:', error);
          throw error;
        }
      }
    },
  });

  return {
    watchInstall,
    streamResult,
  };
};

// Shared helper for processing template installation streams (streamlined)
const useTemplateStreamProcessor = (workflowInfo?: any, runId?: string) => {
  const [streamResult, setStreamResult] = useState<any>({});
  const [isStreaming, setIsStreaming] = useState(false);

  const processStream = async (stream: any, initialRunId?: string) => {
    setIsStreaming(true);
    setStreamResult({});

    if (!stream) throw new Error('No stream returned');

    const reader = stream.getReader();

    // Initialize minimal state - don't set immediately, let events drive the state
    let currentState: any = {
      runId: initialRunId || runId,
      eventTimestamp: new Date().toISOString(),
      phase: 'running',
      payload: {
        workflowState: {
          steps: {},
        },
        currentStep: null,
      },
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const { newState } = processTemplateInstallRecord(value, currentState, workflowInfo);

        currentState = newState;
        setStreamResult(newState);

        // Save to localStorage for refresh recovery (same as watch)
        if (value.runId || initialRunId || runId) {
          const effectiveRunId = value.runId || initialRunId || runId;
          saveTemplateStateToLocalStorage(effectiveRunId, newState);
        }
      }
    } catch (error) {
      console.error('💥 [processStream] Error processing template installation stream:', error);

      // Use the helper for error handling too
      const { newState } = processTemplateInstallRecord(
        { type: 'error', payload: { error: error instanceof Error ? error.message : 'Unknown error' } },
        currentState,
        workflowInfo,
      );

      setStreamResult(newState);
    } finally {
      setIsStreaming(false);
      reader.releaseLock();
    }
  };

  return {
    streamResult,
    isStreaming,
    processStream,
  };
};

export const useStreamTemplateInstall = (workflowInfo?: any) => {
  const { streamResult, isStreaming, processStream } = useTemplateStreamProcessor(workflowInfo);

  const streamInstall = useMutation({
    mutationFn: async ({
      inputData,
      selectedModel,
      runId,
    }: {
      inputData: TemplateInstallationRequest;
      selectedModel: { provider: string; modelId: string };
      runId?: string;
    }) => {
      const maxRetries = 3;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const template = client.getAgentBuilderAction('merge-template');
          const runtimeContext = new RuntimeContext();
          runtimeContext.set('selectedModel', selectedModel);
          const stream = await template.stream({ inputData, runtimeContext }, runId);
          await processStream(stream, runId);

          // If we get here, the stream completed successfully
          return;
        } catch (error: any) {
          console.error(`💥 [streamInstall] Attempt ${attempt} failed:`, error);
          const isNetworkError =
            error?.message?.includes('Failed to fetch') ||
            error?.message?.includes('NetworkError') ||
            error?.message?.includes('network error') ||
            error?.message?.includes('fetch') ||
            error?.code === 'NETWORK_ERROR' ||
            error?.name === 'TypeError';

          console.warn(`Stream attempt ${attempt}/${maxRetries} failed:`, error);

          if (isNetworkError) {
            // For stream network errors, provide helpful message since switching context is complex
            const errorMessage = runId
              ? `Network error during template installation (likely hot reload). Please refresh the page to resume from where you left off using runId: ${runId}`
              : 'Network error during template installation (likely hot reload). Please try again.';

            console.error('🔌 Stream network error:', errorMessage);
            throw new Error(errorMessage);
          }

          // If it's not a network error or we've exhausted retries, throw
          console.error('❌ [streamInstall] Non-network error or max retries reached, throwing:', error);
          throw error;
        }
      }
    },
  });

  return {
    streamInstall,
    streamResult,
    isStreaming,
  };
};
