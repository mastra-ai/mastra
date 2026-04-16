import { EntityListPageLayout, MainHeader } from '@mastra/playground-ui';
import { BarChart3Icon, EyeIcon } from 'lucide-react';
import { Link } from 'react-router';

const sections = [
  {
    title: 'Metrics',
    description: 'View system performance metrics, request latencies, and throughput across your agents and workflows.',
    icon: BarChart3Icon,
    href: '/metrics',
  },
  {
    title: 'Traces',
    description: 'Explore distributed traces to debug and understand the execution flow of your AI operations.',
    icon: EyeIcon,
    href: '/observability',
  },
];

export default function ObservabilityOverview() {
  return (
    <EntityListPageLayout>
      <EntityListPageLayout.Top>
        <MainHeader withMargins={false}>
          <MainHeader.Column>
            <MainHeader.Title>
              <EyeIcon /> Observability
            </MainHeader.Title>
          </MainHeader.Column>
        </MainHeader>
      </EntityListPageLayout.Top>

      <div className="px-6 pt-6 overflow-y-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
          {sections.map(section => (
            <Link
              key={section.href}
              to={section.href}
              className="group flex flex-col gap-3 rounded-lg border border-border1 bg-surface2 p-5 transition-colors hover:border-accent1 hover:bg-surface3"
            >
              <div className="flex items-center gap-2.5">
                <section.icon className="h-5 w-5 text-icon3 group-hover:text-accent1 transition-colors" />
                <span className="text-ui-md font-medium text-text1">{section.title}</span>
              </div>
              <p className="text-ui-sm text-text3 leading-relaxed">{section.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </EntityListPageLayout>
  );
}
