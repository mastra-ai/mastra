import { Icon } from '@/components/icon';
import Breadcrumb from '@/components/ui/breadcrumbs';
import { Button } from '@/components/ui/button';

import { useManageWorkflow } from '../../hooks/use-manage-workflow';

const WorkflowsHeader = () => {
  const { handleCreateWorkflow } = useManageWorkflow();
  return (
    <div className="flex h-[var(--top-bar-height)] w-full content-center items-center justify-between border-b-[0.1px] border-mastra-border-1 px-[1.31rem]">
      <div className="inline-flex h-[26px] w-[125px] items-center justify-start gap-3">
        <Breadcrumb
          items={[
            {
              label: 'Workflows',
              href: ``,
              isCurrent: true,
            },
          ]}
          pageClassName="font-medium"
        />
      </div>

      <Button size="xs" variant="outline" className="flex gap-2" onClick={handleCreateWorkflow}>
        <Icon name="plus-icon" className="text-current" />
        <span className="text-xs">New workflow</span>
      </Button>
    </div>
  );
};

export default WorkflowsHeader;
