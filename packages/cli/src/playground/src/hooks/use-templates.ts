import { useQuery, useMutation } from '@tanstack/react-query';

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

interface TemplateInstallationRequest {
  repo: string;
  ref?: string;
  slug?: string;
  targetPath?: string;
  variables?: Record<string, string>;
}

interface TemplateInstallationResult {
  success: boolean;
  applied: boolean;
  branchName?: string;
  message: string;
  // Optional error message from workflow
  error?: string;
  // Optional validation result details
  validationResults?: {
    valid: boolean;
    errorsFixed: number;
    remainingErrors: number;
  };
  // Optional array of errors from different steps
  errors?: string[];
  // Optional detailed step results
  stepResults?: {
    copySuccess: boolean;
    mergeSuccess: boolean;
    validationSuccess: boolean;
    filesCopied: number;
    conflictsSkipped: number;
    conflictsResolved: number;
  };
}

async function installTemplate(request: TemplateInstallationRequest): Promise<TemplateInstallationResult> {
  const response = await fetch('/api/templates/install', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  // Try to parse JSON regardless of status to extract error details
  let data: any = null;
  try {
    data = await response.json();
  } catch {
    // ignore parse errors; we'll use status text below
  }

  if (!response.ok) {
    const msg =
      data && typeof data.error === 'string'
        ? data.error
        : `Template installation failed: ${response.status} ${response.statusText}`;
    throw new Error(msg);
  }

  // At this point we expect TemplateInstallationResult shape
  const result = data as TemplateInstallationResult;
  if (!result?.success) {
    // Treat workflow-level failure as an error for the UI layer
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
