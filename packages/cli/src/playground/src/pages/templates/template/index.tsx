import {
  useTemplateRepo,
  useTemplateRepoEnvVars,
  useStreamTemplateInstall,
  useCreateTemplateInstallRun,
  useAgentBuilderWorkflow,
} from '@/hooks/use-templates';
import { cn } from '@/lib/utils';
import {
  Breadcrumb,
  Crumb,
  Header,
  MainContentLayout,
  TemplateInfo,
  TemplateForm,
  TemplateInstallation,
  TemplateSuccess,
  ToolsIcon,
  AgentIcon,
  TemplateFailure,
} from '@mastra/playground-ui';
import { Link, useParams } from 'react-router';
import { useEffect, useState } from 'react';
import { BrainIcon, TagIcon, WorkflowIcon } from 'lucide-react';

export default function Template() {
  const { templateSlug } = useParams()! as { templateSlug: string };
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [variables, setVariables] = useState({});
  const [errors, setErrors] = useState<string[]>([]);
  const [failure, setFailure] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [currentRunId, setCurrentRunId] = useState<string>('');

  const { data: template, isLoading: isLoadingTemplate } = useTemplateRepo({
    repoOrSlug: templateSlug,
    owner: 'mastra-ai',
  });

  const { data: templateEnvVars, isLoading: isLoadingEnvVars } = useTemplateRepoEnvVars({
    repo: `template-${templateSlug}`,
    owner: 'mastra-ai',
    branch: selectedProvider,
  });

  // Fetch agent builder workflow info for step pre-population
  const { data: workflowInfo } = useAgentBuilderWorkflow();

  const { mutateAsync: createTemplateInstallRun } = useCreateTemplateInstallRun();
  const { streamInstall, streamResult, isStreaming, installationResult } = useStreamTemplateInstall(workflowInfo);

  const providerOptions = [
    { value: 'openai', label: 'OpenAI' },
    { value: 'anthropic', label: 'Anthropic' },
    { value: 'groq', label: 'Groq' },
    { value: 'google', label: 'Google' },
  ];

  const templateInfoData = [
    {
      key: 'tools',
      label: 'Tools',
      value: template?.tools?.length ? template.tools.map(tool => tool).join(', ') : 'n/a',
      icon: <ToolsIcon />,
    },
    {
      key: 'agents',
      label: 'Agents',
      value: template?.agents?.length ? template.agents.map(agent => agent).join(', ') : 'n/a',
      icon: <AgentIcon />,
    },
    {
      key: 'workflows',
      label: 'Workflows',
      value: template?.workflows?.length ? template.workflows.map(workflow => workflow).join(', ') : 'n/a',
      icon: <WorkflowIcon />,
    },
    {
      key: 'providers',
      label: 'Providers',
      value: template?.supportedProviders?.length ? template.supportedProviders.join(', ') : 'n/a',
      icon: <BrainIcon />,
    },
    {
      key: 'tags',
      label: 'Tags',
      value: template?.tags?.length ? template.tags.join(', ') : 'n/a',
      icon: <TagIcon />,
    },
  ];

  // mock of installed entities
  // In a real application, this data would be fetched from the server or derived from the template installation process
  // For now, we are just simulating the installation of three entities: a tool,
  const installedEntities = [
    {
      ...templateInfoData[0],
    },
    {
      ...templateInfoData[1],
    },
    {
      ...templateInfoData[2],
    },
  ].filter(entity => entity.value !== 'n/a');

  useEffect(() => {
    if (templateEnvVars) {
      setVariables(templateEnvVars);
    }
  }, [templateEnvVars]);

  const handleProviderChange = (value: string) => {
    setSelectedProvider(value);
  };

  const handleInstallTemplate = async () => {
    const errors = Object.entries(variables).reduce((acc, [key, value]) => {
      if (value === '') {
        acc.push(key);
      }
      return acc;
    }, [] as string[]);

    if (errors.length > 0) {
      setErrors(errors);
      return;
    }

    if (template) {
      // Reset states
      setFailure(null);
      setSuccess(false);
      setCurrentRunId('');

      try {
        const repo = template.githubUrl || `https://github.com/mastra-ai/template-${template.slug}`;
        const templateParams = {
          repo,
          ref: selectedProvider || 'main',
          slug: template.slug,
          variables: variables as Record<string, string>,
        };

        // Step 1: Create the template installation run
        const { runId } = await createTemplateInstallRun({
          templateSlug: template.slug,
          params: templateParams,
        });

        setCurrentRunId(runId);

        // Step 2: Start streaming the installation with the runId
        await streamInstall.mutateAsync({
          templateSlug: template.slug,
          params: templateParams,
          runId,
        });
      } catch (err: any) {
        setFailure(err?.message || 'Template installation failed');
        console.error('Template installation failed', err);
      }
    }
  };

  // Watch for installation completion
  useEffect(() => {
    if (installationResult) {
      console.log('installationResult', installationResult);
      if (installationResult.success) {
        setSuccess(true);
      } else {
        setFailure(installationResult.error || installationResult.message || 'Template installation failed');
      }
    }
  }, [installationResult]);

  const handleVariableChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    if (value.trim() === '') {
      setErrors(prev => [...prev, name]);
    } else {
      setErrors(prev => prev.filter(error => error !== name));
    }

    setVariables(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  console.log('streamResult', streamResult);

  return (
    <MainContentLayout>
      <Header>
        <Breadcrumb>
          <Crumb as={Link} to={`/templates`}>
            Templates
          </Crumb>

          <Crumb as={Link} to={`/templates/${template?.slug}`} isCurrent>
            {template?.title && template.title}
          </Crumb>
        </Breadcrumb>
      </Header>
      <div
        className={cn(
          'max-w-[80rem] w-full px-[1.5rem] lg:px-[3rem] mx-auto grid gap-y-[1rem] h-full overflow-y-scroll',
        )}
      >
        <div className="p-[1.5rem]">
          <TemplateInfo
            isLoading={isLoadingTemplate}
            title={template?.title}
            description={template?.longDescription}
            imageURL={template?.imageURL}
            githubUrl={template?.githubUrl}
            infoData={templateInfoData}
          />
          {template && (
            <>
              {isStreaming && (
                <TemplateInstallation
                  name={template.title}
                  streamResult={streamResult}
                  runId={currentRunId}
                  workflowInfo={workflowInfo}
                />
              )}

              {template && success && (
                <TemplateSuccess name={template.title} installedEntities={installedEntities} linkComponent={Link} />
              )}

              {template && failure && <TemplateFailure errorMsg={failure} />}

              {!isStreaming && !success && !failure && (
                <TemplateForm
                  providerOptions={providerOptions}
                  selectedProvider={selectedProvider}
                  onProviderChange={handleProviderChange}
                  variables={variables}
                  setVariables={setVariables}
                  errors={errors}
                  setErrors={setErrors}
                  handleInstallTemplate={handleInstallTemplate}
                  handleVariableChange={handleVariableChange}
                  isLoadingEnvVars={isLoadingEnvVars}
                />
              )}
            </>
          )}
        </div>
      </div>
    </MainContentLayout>
  );
}
