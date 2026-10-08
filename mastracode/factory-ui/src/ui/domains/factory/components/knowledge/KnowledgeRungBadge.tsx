import { Badge } from '@mastra/playground-ui/components/Badge';
import type { KnowledgeRung } from '../../services/knowledge';
import { knowledgeScopes } from './knowledgeScope';
const RUNG_LABELS: Record<KnowledgeRung, string> = { org: 'org', resource: 'project', thread: 'session' };

export function KnowledgeRungBadge({ rung }: { rung: KnowledgeRung }) {
  return (
    <Badge variant={knowledgeScopes[rung].tone} emphasis="subtle">
      {RUNG_LABELS[rung]}
    </Badge>
  );
}
