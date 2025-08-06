import { useTemplateRepo } from '@/hooks/use-templates';
import { cn } from '@/lib/utils';
import { Breadcrumb, Crumb, GithubIcon, Header, MainContentLayout } from '@mastra/playground-ui';
import { Link, useParams } from 'react-router';
import { Select, SelectContent, SelectItem, SelectValue, SelectTrigger } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useEffect, useState } from 'react';
import { PackageOpenIcon } from 'lucide-react';

export default function Template() {
  const { templateSlug } = useParams()! as { templateSlug: string };
  const { data: template } = useTemplateRepo({ repoOrSlug: templateSlug, owner: 'mastra-ai' });
  const [isInstalling, setIsInstalling] = useState(false);
  const [currentLogs, setCurrentLogs] = useState<string>(``);

  useEffect(() => {
    if (isInstalling) {
      const interval = setInterval(() => {
        const logIndex = Math.floor(Math.random() * logs.length);
        setCurrentLogs(prevLogs => `${prevLogs}\n${logs[logIndex]}`);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isInstalling]);

  const logs = [
    `[INFO] [08/05/2025, 04:03:54 PM] - Cloning into '/data/project'...`,
    `[INFO] [08/05/2025, 04:03:54 PM] - Deploying project...`,
    `[INFO] [08/05/2025, 04:03:54 PM] - Installing dependencies with npm in /data/project`,
    `[INFO] [08/05/2025, 04:04:47 PM] - npm warn deprecated node-domexception@1.0.0: Use your platform's native DOMException instead`,
    `[INFO] [08/05/2025, 04:04:55 PM] - added 585 packages, and audited 586 packages in 1m`,
    `[INFO] [08/05/2025, 04:04:55 PM] - 123 packages are looking for funding`,
    `[INFO] [08/05/2025, 04:04:55 PM] - found 0 vulnerabilities`,
    `[INFO] [08/05/2025, 04:04:55 PM] - Using deployer core-latest`,
    `[INFO] [08/05/2025, 04:04:55 PM] - Start bundling Mastra`,
    `[INFO] [08/05/2025, 04:04:56 PM] - Analyzing dependencies...`,
    `[INFO] [08/05/2025, 04:04:57 PM] - Analyzing dependencies...`,
  ];

  return (
    <MainContentLayout>
      <Header>
        <Breadcrumb>
          <Crumb as={Link} to={`/templates`}>
            Templates
          </Crumb>

          <Crumb as={Link} to={`/templates/${template?.slug}`} isCurrent>
            {template?.title || 'Not found'}
          </Crumb>
        </Breadcrumb>
      </Header>
      <div className={cn('max-w-[80rem] w-full px-[3rem] mx-auto grid gap-y-[1rem] h-full overflow-y-scroll')}>
        <div className={cn(``)}>
          {template ? (
            <div className="p-[1.5rem] ">
              <h2 className="text-[1.5rem] mt-[2rem] ">{template.title}</h2>
              <div className="grid grid-cols-[1fr_1fr]  gap-x-[6rem] mt-[2rem] ">
                <div className="grid">
                  <p className="mb-[1rem] text-[0.875rem] text-icon4">{template.longDescription}</p>
                  <a
                    href={template.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-[.5rem] mt-auto text-icon3 hover:text-icon5"
                  >
                    <GithubIcon />
                    {template?.githubUrl?.split('/')?.pop()}
                  </a>
                </div>
                <dl
                  className={cn(
                    'grid grid-cols-[auto_1fr] text-[0.875rem]  gap-x-[2rem]  text-icon3 items-center gap-y-[0.5rem]',
                    '[&>dt]:flex [&>dt]:items-center [&>dt]:gap-x-2',
                    ' [&>dd]:text-icon4',
                    '[&_svg]:w-[1.1em] [&_svg]:h-[1.1em] [&_svg]:text-icon3',
                  )}
                >
                  {template?.tools && template.tools.length > 0 && (
                    <>
                      <dt>Tools</dt>
                      <dd>{template.tools.map(tool => tool).join(', ')}</dd>
                    </>
                  )}
                  {template?.agents && template.agents.length > 0 && (
                    <>
                      <dt>Agents</dt>
                      <dd>{template.agents.map(agent => agent).join(', ')}</dd>
                    </>
                  )}
                  {template?.workflows && template.workflows.length > 0 && (
                    <>
                      <dt>Workflows</dt>
                      <dd>{template.workflows.map(workflow => workflow).join(', ')}</dd>
                    </>
                  )}
                  {template?.mcp && template.mcp.length > 0 && (
                    <>
                      <dt>MCP Servers</dt>
                      <dd>{template.mcp.map(mcp => mcp).join(', ')}</dd>
                    </>
                  )}
                  {template?.networks && template.networks.length > 0 && (
                    <>
                      <dt>Networks</dt>
                      <dd>{template.networks.map(network => network).join(', ')}</dd>
                    </>
                  )}
                  {template?.supportedProviders && template.supportedProviders.length > 0 && (
                    <>
                      <dt>Providers</dt>
                      <dd>{template.supportedProviders.join(', ')}</dd>
                    </>
                  )}
                  {template.tags && template.tags.length > 0 && (
                    <>
                      <dt>Tags</dt>
                      <dd>{template.tags.map(tag => tag).join(', ')}</dd>
                    </>
                  )}
                </dl>
              </div>
              <div className="border border-border1 rounded-lg mt-[3rem]">
                {isInstalling ? (
                  <div>
                    <pre className="text-[0.875rem] text-icon3 whitespace-pre-wrap p-[1.5rem] leading-[1.5rem]">
                      {currentLogs}
                    </pre>
                  </div>
                ) : (
                  <div className="max-w-[40rem] my-[2rem] p-[2rem] mx-auto ">
                    <div className="grid gap-[1rem]">
                      <Label>Provider</Label>
                      <Select
                        name="filter-by-entity"
                        onValueChange={value => {
                          // handleFilterChange(value, 'provider');
                        }}
                        defaultValue={''}
                        value={''}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {(template.supportedProviders || []).map(provider => (
                            <SelectItem key={provider} value={`${provider}`}>
                              {provider}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="grid gap-[2rem]">
                        <Label>Environmental Variables</Label>

                        <div className="grid grid-cols-[1fr_1fr] gap-[1rem]">
                          <div className="flex flex-col gap-[0.5rem]">
                            <Label>Key</Label>
                            <Input type="text" className="w-full" value={'OPENAI_API_KEY'} />
                          </div>
                          <div>
                            <Label>Value</Label>
                            <Input type="text" className="w-full" value={''} />
                          </div>
                        </div>

                        <div className="grid grid-cols-[1fr_1fr] gap-[1rem]">
                          <div className="flex flex-col gap-[0.5rem]">
                            <Label>Key</Label>
                            <Input type="text" className="w-full" value={'MODEL'} />
                          </div>
                          <div>
                            <Label>Value</Label>
                            <Input type="text" className="w-full" value={''} />
                          </div>
                        </div>

                        <button
                          className={cn(
                            'flex items-center gap-[0.5rem] justify-center text-[0.875rem] w-full bg-surface5 min-h-[2.5rem] rounded-lg text-icon5 hover:bg-surface6 transition-colors',
                            '[&<svg]:w-[1.1em] [&_svg]:h-[1.1em] [&_svg]:text-icon5',
                          )}
                          onClick={() => {
                            setIsInstalling(true);
                          }}
                        >
                          Install Template <PackageOpenIcon />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-red-500">Template not found.</p>
          )}
        </div>
      </div>
    </MainContentLayout>
  );
}
