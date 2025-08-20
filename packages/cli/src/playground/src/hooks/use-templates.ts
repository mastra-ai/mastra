import { useQuery, useMutation } from '@tanstack/react-query';
import { TemplateInstallationRequest, TemplateInstallationResult } from '@mastra/client-js';
import type { RuntimeContext } from '@mastra/core/runtime-context';
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

async function installTemplate(request: TemplateInstallationRequest): Promise<TemplateInstallationResult> {
  const template = client.getTemplates();
  const result = await template.installAsync(request.slug!, request);

  if (!result?.success) {
    throw new Error(result?.error || result?.message || 'Template installation failed');
  }
  return result;
}

export const useMastraTemplates = () => {
  return useQuery({
    queryKey: ['mastra-templates'],
    queryFn: getMastraTemplateRepos,
  });
};

export const useInstallTemplate = () => {
  return useMutation({
    mutationFn: installTemplate,
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

export const useCreateTemplateInstallRun = () => {
  return useMutation({
    mutationFn: async ({
      templateSlug,
      params,
      runId,
    }: {
      templateSlug: string;
      params: TemplateInstallationRequest & { runtimeContext?: RuntimeContext };
      runId?: string;
    }) => {
      const template = client.getTemplates();
      return await template.createInstallRun(templateSlug, params, runId);
    },
  });
};

export const useInstallTemplateAsync = () => {
  return useMutation({
    mutationFn: async ({
      templateSlug,
      params,
      runId,
    }: {
      templateSlug: string;
      params: TemplateInstallationRequest & { runtimeContext?: RuntimeContext };
      runId?: string;
    }) => {
      const template = client.getTemplates();
      const result = await template.installAsync(templateSlug, params, runId);

      if (!result?.success) {
        throw new Error(result?.error || result?.message || 'Template installation failed');
      }
      return result;
    },
  });
};

export const useStreamTemplateInstall = () => {
  const [streamResult, setStreamResult] = useState<any>({});
  const [isStreaming, setIsStreaming] = useState(false);
  const [installationResult, setInstallationResult] = useState<TemplateInstallationResult | null>(null);

  const streamInstall = useMutation({
    mutationFn: async ({
      templateSlug,
      params,
      runId,
    }: {
      templateSlug: string;
      params: TemplateInstallationRequest & { runtimeContext?: RuntimeContext };
      runId?: string;
    }) => {
      setIsStreaming(true);
      setStreamResult({});
      setInstallationResult(null);

      const template = client.getTemplates();
      const stream = await template.streamInstall(templateSlug, params, runId);

      if (!stream) throw new Error('No stream returned');

      // Get a reader from the ReadableStream
      const reader = stream.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Handle different event types from the template installation workflow
          if (value.type === 'start') {
            setStreamResult((prev: any) => ({
              ...prev,
              runId: value.payload.runId,
              eventTimestamp: new Date(),
              status: 'running',
              message: 'Template installation started...',
            }));
          }

          if (value.type === 'step-start') {
            setStreamResult((prev: any) => ({
              ...prev,
              currentStep: {
                id: value.payload.id,
                name: value.payload.name || value.payload.id,
                status: 'running',
              },
              eventTimestamp: new Date(),
              message: `Starting step: ${value.payload.name || value.payload.id}`,
            }));
          }

          if (value.type === 'step-result') {
            setStreamResult((prev: any) => ({
              ...prev,
              currentStep: {
                ...prev.currentStep,
                status: value.payload.status,
                output: value.payload.output,
                error: value.payload.error,
              },
              eventTimestamp: new Date(),
              message:
                value.payload.status === 'success'
                  ? `Completed step: ${prev.currentStep?.name || value.payload.id}`
                  : `Failed step: ${prev.currentStep?.name || value.payload.id}`,
            }));
          }

          if (value.type === 'step-finish') {
            setStreamResult((prev: any) => ({
              ...prev,
              currentStep: undefined,
              eventTimestamp: new Date(),
            }));
          }

          if (value.type === 'finish') {
            const finalResult = value.payload.result;
            setStreamResult((prev: any) => ({
              ...prev,
              status: value.payload.status,
              currentStep: undefined,
              eventTimestamp: new Date(),
              message:
                value.payload.status === 'success'
                  ? 'Template installation completed successfully!'
                  : 'Template installation failed',
            }));

            // Transform the final workflow result to TemplateInstallationResult
            if (finalResult) {
              const templateResult: TemplateInstallationResult = {
                success: finalResult.success || false,
                applied: finalResult.applied || false,
                branchName: finalResult.branchName,
                message:
                  finalResult.message ||
                  (value.payload.status === 'success'
                    ? 'Template installation completed'
                    : 'Template installation failed'),
                validationResults: finalResult.validationResults,
                error: finalResult.error,
                errors: finalResult.errors,
                stepResults: finalResult.stepResults,
              };
              setInstallationResult(templateResult);
            }
          }

          if (value.type === 'error') {
            setStreamResult((prev: any) => ({
              ...prev,
              status: 'failed',
              error: value.payload.error,
              eventTimestamp: new Date(),
              message: `Error: ${value.payload.error}`,
            }));
          }
        }
      } catch (error) {
        console.error('Error streaming template installation:', error);
        setStreamResult((prev: any) => ({
          ...prev,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          eventTimestamp: new Date(),
          message: 'Template installation failed with error',
        }));
      } finally {
        setIsStreaming(false);
        reader.releaseLock();
      }
    },
  });

  return {
    streamInstall,
    streamResult,
    isStreaming,
    installationResult,
  };
};
