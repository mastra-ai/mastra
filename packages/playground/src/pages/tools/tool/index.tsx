import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { useParams } from 'react-router';
import { pageHeaderProps } from '@/components/ui/page-header-props';
import { navCrumb, toolCrumb } from '@/domains/navigation/crumbs';
import { ToolPanel } from '@/domains/tools/components/ToolPanel';

const Tool = () => {
  const { toolId } = useParams();
  const crumbs = [navCrumb('/tools'), toolCrumb];

  return (
    <PageLayout {...pageHeaderProps(crumbs)} height="full" className="grid-rows-[minmax(0,1fr)] p-0">
      <div className="h-full w-full overflow-y-hidden">
        <ToolPanel toolId={toolId!} />
      </div>
    </PageLayout>
  );
};

export default Tool;
