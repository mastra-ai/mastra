import { useTemplateRepo } from '@/hooks/use-templates';
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
} from '@mastra/playground-ui';
import { Link, useParams } from 'react-router';
import { useEffect, useState } from 'react';
import { useTemplateEnvVars } from '@/domains/templates/use-template-envvars';
import { BrainIcon, TagIcon, WorkflowIcon } from 'lucide-react';

export default function Template() {
  const { templateSlug } = useParams()! as { templateSlug: string };
  const { data: template, isLoading } = useTemplateRepo({ repoOrSlug: templateSlug, owner: 'mastra-ai' });
  const [isInstalling, setIsInstalling] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const { data: templateEnvVars, ok: templateEnvVarsLoaded } = useTemplateEnvVars(selectedProvider);
  const [variables, setVariables] = useState({});
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);

  const providerOptions = (template?.supportedProviders || []).map(provider => ({ value: provider, label: provider }));

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

  console.log({ templateInfoData });

  const installedEntities = [
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
  ];

  useEffect(() => {
    if (templateEnvVarsLoaded) {
      setVariables(templateEnvVars || {});
    }
  }, [templateEnvVarsLoaded, templateEnvVars]);

  const handleProviderChange = (value: string) => {
    setSelectedProvider(value);
  };

  const handleInstallTemplate = () => {
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
      setIsInstalling(true);

      setTimeout(() => {
        setIsInstalling(false);
        setSuccess(true);
      }, 4000);
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
      <div className={cn('max-w-[80rem] w-full px-[3rem] mx-auto grid gap-y-[1rem] h-full overflow-y-scroll')}>
        {template && (
          <div className="p-[1.5rem] ">
            <TemplateInfo
              isLoading={true}
              title={template.title}
              description={template.longDescription}
              imageURL={template.imageURL}
              githubUrl={template.githubUrl}
              infoData={templateInfoData}
            />
            {template && (
              <>
                {isInstalling && <TemplateInstallation name={template.title} />}
                {template && success && (
                  <TemplateSuccess name={template.title} installedEntities={installedEntities} linkComponent={Link} />
                )}
                {!isInstalling && !success && (
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
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>
    </MainContentLayout>
  );
}
