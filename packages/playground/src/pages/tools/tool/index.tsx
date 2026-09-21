import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { useParams } from 'react-router';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { navCrumb, toolCrumb } from '@/domains/navigation/crumbs';
import { ToolPanel } from '@/domains/tools/components/ToolPanel';

const Tool = () => {
  const { toolId } = useParams();
  const crumbs = [navCrumb('/tools'), toolCrumb];

  return (
    <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />} className="grid grid-rows-[minmax(0,1fr)]">
      <div className="h-full w-full overflow-y-hidden">
        <ToolPanel toolId={toolId!} />
      </div>
    </PageLayout>
  );
};

export default Tool;
