import { ToolCard } from '../../tool/ToolCard';
import type { ToolView } from '../activity-header';
import type { ActivityView } from '../activity-view';

/** A call's open state lives in its view, so a re-hosted stretch keeps its rows as the reader left them. */
export function ToolRow({ member, view }: { member: ToolView; view: ActivityView }) {
  function rememberOpen(open: boolean) {
    if (open) view.openRows.add(member.key);
    else view.openRows.delete(member.key);
  }

  return <ToolCard tool={member.tool} defaultOpen={view.openRows.has(member.key)} onOpenChange={rememberOpen} />;
}
