import { PageHeader, PageLayout } from '@mastra/playground-ui';
import { BookIcon, EarthIcon, MessageSquareIcon, ExternalLinkIcon, CloudUploadIcon, BuildingIcon } from 'lucide-react';

const resources = [
  {
    title: 'Mastra APIs',
    description: 'Explore and test the available REST API endpoints with the interactive Swagger UI.',
    icon: EarthIcon,
    href: '/swagger-ui',
    external: false,
  },
  {
    title: 'Documentation',
    description: 'Read the official Mastra documentation for guides, references, and tutorials.',
    icon: BookIcon,
    href: 'https://mastra.ai/en/docs',
    external: true,
  },
  {
    title: 'Github',
    description: 'Browse the source code, report issues, and contribute to the Mastra project.',
    icon: ExternalLinkIcon,
    href: 'https://github.com/mastra-ai/mastra',
    external: true,
  },
  {
    title: 'Community',
    description: 'Join the Mastra Discord community for help, discussion, and collaboration.',
    icon: MessageSquareIcon,
    href: 'https://discord.gg/BTYqqHKUrf',
    external: true,
  },
  {
    title: 'Share with your team',
    description: 'Running Mastra Studio locally? Deploy to the cloud so your team can collaborate.',
    icon: CloudUploadIcon,
    href: 'https://mastra.ai/cloud',
    external: true,
  },
  {
    title: 'Talk to our Sales team',
    description:
      'Get a custom demo, discuss on-prem deployments, and how we can help you accelerate getting agents into production.',
    icon: BuildingIcon,
    href: 'https://mastra.ai/contact?ref=studio',
    external: true,
  },
];

export default function Resources() {
  return (
    <PageLayout width="narrow">
      <PageLayout.TopArea>
        <PageHeader>
          <PageHeader.Title>
            <BookIcon /> Resources
          </PageHeader.Title>
        </PageHeader>
      </PageLayout.TopArea>

      <PageLayout.MainArea>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
          {resources.map(resource => (
            <a
              key={resource.href}
              href={resource.href}
              {...(resource.external ? { target: '_blank', rel: 'noreferrer' } : {})}
              className="group flex flex-col gap-3 rounded-lg border border-border1 bg-surface2 p-5 transition-colors hover:border-accent1 hover:bg-surface3"
            >
              <div className="flex items-center gap-2.5">
                <resource.icon className="h-5 w-5 text-icon3 group-hover:text-accent1 transition-colors" />
                <span className="text-ui-md font-medium text-text1">{resource.title}</span>
                {resource.external && (
                  <ExternalLinkIcon className="h-3.5 w-3.5 text-icon3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
              <p className="text-ui-sm text-text3 leading-relaxed">{resource.description}</p>
            </a>
          ))}
        </div>
      </PageLayout.MainArea>
    </PageLayout>
  );
}
