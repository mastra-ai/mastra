import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { Breadcrumb, Crumb } from '@mastra/playground-ui/components/Breadcrumb';
import { Button } from '@mastra/playground-ui/components/Button';
import { PageHeader } from '@mastra/playground-ui/components/PageHeader';
import { IconPlusMedium } from '@mastra/playground-ui/icons/central/IconPlusMedium';
import { Link } from 'react-router';

import { useBoardQuery } from '../../hooks/useBoardEditor';
import { useFactorySkillsQuery } from '../../hooks/useFactorySkills';
import { useSidebarHeaderSlots } from '../domains/chat/components/useSidebarHeaderSlots';
import { boardConfigPath, newSkillPath } from '../domains/boardConfig/boardConfigPaths';
import { FactorySkillsSection } from '../domains/boardConfig/components/skills/FactorySkillsSection';
import { useBoardConfigRoute } from '../domains/boardConfig/hooks/useBoardConfigRoute';
import { useActiveFactory } from '../domains/workspaces/components/FactoryLayout';

/**
 * The factory's skills that no board phase runs, opened from board settings. The board in the URL only leads back
 * to its settings; the skills belong to the whole factory.
 */
export function FactorySkillsPage() {
  const factory = useActiveFactory();
  const boardId = useBoardConfigRoute()?.boardId ?? '';
  const board = useBoardQuery(factory.id, boardId).data?.board;
  const canEdit = useFactorySkillsQuery(factory.id).data?.canEdit ?? false;

  const slots = useSidebarHeaderSlots({
    breadcrumbs: board ? (
      <Breadcrumb label="Breadcrumb" className="min-w-0 flex-1 overflow-hidden">
        <Crumb as={Link} to={boardConfigPath(factory.id, boardId)}>
          {board.name}
        </Crumb>
        <Crumb as="span" isCurrent>
          Skills
        </Crumb>
      </Breadcrumb>
    ) : undefined,
  });

  return (
    <PageLayout
      variant="settings"
      header={
        <PageHeader>
          <PageHeader.Title>Skills</PageHeader.Title>
          <PageHeader.Description>
            Agents load these when they need them. Pick the skills a phase runs from that phase on the board.
          </PageHeader.Description>
          {canEdit && (
            <PageHeader.Action>
              <Button size="sm" icon={<IconPlusMedium />} render={<Link to={newSkillPath(factory.id, boardId)} />}>
                New skill
              </Button>
            </PageHeader.Action>
          )}
        </PageHeader>
      }
      {...slots}
    >
      <FactorySkillsSection factoryId={factory.id} boardId={boardId} />
    </PageLayout>
  );
}
