import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconBook } from '@mastra/playground-ui/icons/central/IconBook';
import { IconBubble2 } from '@mastra/playground-ui/icons/central/IconBubble2';
import { IconBuildings } from '@mastra/playground-ui/icons/central/IconBuildings';
import { IconCloudUpload } from '@mastra/playground-ui/icons/central/IconCloudUpload';
import { IconEarth } from '@mastra/playground-ui/icons/central/IconEarth';
import { IconSquareArrowTopRight } from '@mastra/playground-ui/icons/central/IconSquareArrowTopRight';
import { controlStateColorTransition } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { navCrumb } from '@/domains/navigation/crumbs';

const crumbs = [navCrumb('/resources')];

const resources = [
  {
    title: 'Mastra APIs',
    description: 'Explore and test the available REST API endpoints with the interactive Swagger UI.',
    icon: IconEarth,
    href: '/swagger-ui',
    external: false,
  },
  {
    title: 'Documentation',
    description: 'Read the official Mastra documentation for guides, references, and tutorials.',
    icon: IconBook,
    href: 'https://mastra.ai/en/docs',
    external: true,
  },
  {
    title: 'Github',
    description: 'Browse the source code, report issues, and contribute to the Mastra project.',
    icon: IconSquareArrowTopRight,
    href: 'https://github.com/mastra-ai/mastra',
    external: true,
  },
  {
    title: 'Community',
    description: 'Join the Mastra Discord community for help, discussion, and collaboration.',
    icon: IconBubble2,
    href: 'https://discord.gg/mastra-ai',
    external: true,
  },
  {
    title: 'Share with your team',
    description: 'Running Mastra Studio locally? Deploy to the cloud so your team can collaborate.',
    icon: IconCloudUpload,
    href: 'https://mastra.ai/cloud',
    external: true,
  },
  {
    title: 'Talk to our Sales team',
    description:
      'Get a custom demo, discuss on-prem deployments, and how we can help you accelerate getting agents into production.',
    icon: IconBuildings,
    href: 'https://mastra.ai/contact?ref=studio',
    external: true,
  },
];

export default function Resources() {
  return (
    <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
      <h1 className="sr-only">Resources</h1>
      <div>
        <div className="grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
          {resources.map(resource => (
            <a
              key={resource.href}
              href={resource.href}
              {...(resource.external ? { target: '_blank', rel: 'noreferrer' } : {})}
              className="group flex flex-col gap-3 rounded-lg border border-border bg-background state-layer p-5 hover:border-border-strong"
            >
              <div className="flex items-center gap-2.5">
                <resource.icon
                  className={cn(
                    'h-5 w-5 text-muted-foreground group-hover:text-info-indicator',
                    controlStateColorTransition,
                  )}
                />
                <Txt as="span" variant="subheading" tone="ink">
                  {resource.title}
                </Txt>
                {resource.external && (
                  <IconSquareArrowTopRight className="ml-auto h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                )}
              </div>
              <Txt variant="caption" tone="muted">
                {resource.description}
              </Txt>
            </a>
          ))}
        </div>
      </div>
    </PageLayout>
  );
}
