import {
  useTemplateRepo,
  useTemplateRepoEnvVars,
  useStreamTemplateInstall,
  useCreateTemplateInstallRun,
  useAgentBuilderWorkflow,
  useGetTemplateInstallRun,
  useWatchTemplateInstall,
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
import { Link, useParams, useSearchParams } from 'react-router';
import { useEffect, useState } from 'react';
import { BrainIcon, TagIcon, WorkflowIcon } from 'lucide-react';

export default function Template() {
  const { templateSlug } = useParams()! as { templateSlug: string };
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [selectedModelProvider, setSelectedModelProvider] = useState<string>('');
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [variables, setVariables] = useState({});
  const [errors, setErrors] = useState<string[]>([]);
  const [failure, setFailure] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [currentRunId, setCurrentRunId] = useState<string>('');
  const [hasAutoResumed, setHasAutoResumed] = useState(false);
  const [isFreshInstall, setIsFreshInstall] = useState(false);
  const [completedRunValidationErrors, setCompletedRunValidationErrors] = useState<any[]>([]);

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
  const { mutateAsync: getTemplateInstallRun } = useGetTemplateInstallRun();
  const { streamInstall, streamResult, isStreaming } = useStreamTemplateInstall(workflowInfo);
  const { watchInstall, streamResult: watchStreamResult } = useWatchTemplateInstall(workflowInfo);

  // Get watching state from the mutation
  const isWatching = watchInstall.isPending;

  // Check for completed runs after hot reload recovery
  useEffect(() => {
    const runId = searchParams.get('runId');

    if (runId && !success && !failure && !isStreaming && !isWatching) {
      console.log('🔄 Checking completed run after hot reload:', { runId });

      setCurrentRunId(runId);

      getTemplateInstallRun({ runId })
        .then((runData: any) => {
          const snapshot = runData.snapshot;

          if (snapshot?.status === 'success' && snapshot?.result?.success) {
            setSuccess(true);
          } else if (snapshot?.result?.success === false) {
            // Check if this is a validation error with specific validation results
            const hasValidationResults =
              snapshot?.result?.validationResults &&
              !snapshot?.result?.validationResults?.valid &&
              snapshot?.result?.validationResults?.remainingErrors > 0;

            if (hasValidationResults) {
              const { remainingErrors, errors } = snapshot.result.validationResults;
              const errorMessage = `Template installation completed but ${remainingErrors} validation issue${remainingErrors > 1 ? 's' : ''} remain unresolved.`;
              setFailure(errorMessage);
              setCompletedRunValidationErrors(errors || []);
            } else {
              setFailure(snapshot?.result?.message || snapshot?.result?.error || 'Template installation failed');
            }
          }
        })
        .catch(error => {
          console.error('❌ Failed to fetch run details:', error);
          setFailure('Failed to retrieve installation status after reload');
        });
    }
  }, [searchParams, success, failure, isStreaming, isWatching, getTemplateInstallRun]);

  // Auto-resume watching from URL parameters
  useEffect(() => {
    const runId = searchParams.get('runId');
    const shouldResume = searchParams.get('resume');
    const savedProvider = searchParams.get('provider');

    // Only resume watching if we have explicit resume parameters and workflow info is loaded
    if (
      runId &&
      shouldResume === 'true' &&
      savedProvider &&
      !isStreaming &&
      !isWatching &&
      !hasAutoResumed &&
      !isFreshInstall &&
      workflowInfo
    ) {
      setCurrentRunId(runId);
      setHasAutoResumed(true); // Prevent multiple auto-resume attempts

      // Check if the run exists and start watching
      try {
        getTemplateInstallRun({ runId })
          .then((runData: any) => {
            const snapshot = runData.snapshot;

            if (snapshot?.status === 'running') {
              return watchInstall.mutateAsync({ runId });
            }
          })
          .then(() => {
            // Clean up URL parameters after successful resume
            setSearchParams(prev => {
              const newParams = new URLSearchParams(prev);
              newParams.delete('resume');
              return newParams;
            });
          })
          .catch((error: any) => {
            console.error('❌ Failed to resume template installation:', error);

            // If run doesn't exist or failed to watch, show error
            if (error.message?.includes('404') || error.message?.includes('not found')) {
              setFailure('Template installation run not found. It may have expired or been completed.');
            } else {
              setFailure('Failed to resume template installation. Please try again.');
            }
          });
      } catch (error) {
        console.error('❌ Auto-resume failed with error:', error);
        setFailure('Failed to resume template installation. Please refresh and try again.');
      }
    }
  }, [
    searchParams,
    templateSlug,
    isStreaming,
    isWatching,
    hasAutoResumed,
    isFreshInstall,
    workflowInfo,
    getTemplateInstallRun,
    watchInstall,
    setSearchParams,
  ]);

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

  // Monitor for workflow errors
  useEffect(() => {
    const result = streamResult || watchStreamResult;

    if (result?.phase === 'error' && result?.error) {
      setFailure(result.error);
    }
  }, [streamResult?.phase, streamResult?.error, watchStreamResult?.phase, watchStreamResult?.error]);

  const handleProviderChange = (value: string) => {
    setSelectedProvider(value);
  };

  const handleModelUpdate = async (params: { provider: string; modelId: string }) => {
    setSelectedModelProvider(params.provider);
    setSelectedModelId(params.modelId);
    return { message: 'Model updated successfully' };
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
      setIsFreshInstall(true); // Mark as fresh install to prevent watch trigger

      try {
        const repo = template.githubUrl || `https://github.com/mastra-ai/template-${template.slug}`;
        const templateParams = {
          repo,
          ref: selectedProvider || 'main',
          slug: template.slug,
          variables: variables as Record<string, string>,
        };

        // Step 1: Create the template installation run
        const { runId } = await createTemplateInstallRun({});

        setCurrentRunId(runId);

        // Update URL with runId and provider for resume capability
        // Note: We don't save variables in URL for security (may contain sensitive env vars)
        setSearchParams(prev => {
          const newParams = new URLSearchParams(prev);
          newParams.set('runId', runId);
          newParams.set('resume', 'true');
          newParams.set('provider', selectedProvider || 'openai');
          return newParams;
        });

        // Step 2: Start streaming the installation with the runId
        await streamInstall.mutateAsync({
          inputData: templateParams,
          selectedModel: {
            provider: selectedModelProvider,
            modelId: selectedModelId,
          },
          runId,
        });
      } catch (err: any) {
        setIsFreshInstall(false); // Reset fresh install flag on error
        setFailure(err?.message || 'Template installation failed');
        console.error('Template installation failed', err);
      }
    }
  };

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
      <div className={cn('w-full lg:px-[3rem] h-full overflow-y-scroll')}>
        <div className="p-[1.5rem] max-w-[80rem] mx-auto grid gap-y-[1rem]">
          <TemplateInfo
            isLoading={isLoadingTemplate}
            title={template?.title}
            description={template?.longDescription}
            imageURL={template?.imageURL}
            githubUrl={template?.githubUrl}
            infoData={templateInfoData}
            templateSlug={templateSlug}
          />
          {template && (
            <>
              {(isStreaming || isWatching) && (
                <TemplateInstallation
                  name={template.title}
                  streamResult={isWatching ? watchStreamResult : streamResult}
                  runId={currentRunId}
                  workflowInfo={workflowInfo}
                />
              )}

              {success && (
                <TemplateSuccess name={template.title} installedEntities={installedEntities} linkComponent={Link} />
              )}

              {failure && (
                <TemplateFailure
                  errorMsg={failure}
                  validationErrors={
                    completedRunValidationErrors.length > 0
                      ? completedRunValidationErrors
                      : streamResult?.validationResults?.errors || watchStreamResult?.validationResults?.errors
                  }
                />
              )}

              {!isStreaming && !isWatching && !success && !failure && (
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
                  defaultModelProvider={selectedModelProvider}
                  defaultModelId={selectedModelId}
                  onModelUpdate={handleModelUpdate}
                />
              )}
            </>
          )}
        </div>
      </div>
    </MainContentLayout>
  );
}
