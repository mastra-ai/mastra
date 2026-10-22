import { parseAuditAction } from '@mastra/factory/storage/domains/audit/actions';
import type { AuditNamespace } from '@mastra/factory/storage/domains/audit/actions';
import type { BadgeVariant } from '@mastra/playground-ui/components/Badge';
import {
  Bot,
  Check,
  Eye,
  GitCommitHorizontal,
  Hammer,
  Inbox,
  ListFilter,
  MapIcon,
  MessageSquare,
  Play,
  SquarePen,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { ActivityEntry } from '../../../../activity';
import { auditCategory } from '../../../../auditPresentation';
import { stageTone } from '../../../../stages';
import { RAIL_MARK_TONE } from '../../../Timeline';

const STAGE_GLYPHS: Record<string, LucideIcon> = {
  intake: Inbox,
  triage: ListFilter,
  planning: MapIcon,
  execute: Hammer,
  review: Eye,
  done: Check,
  canceled: X,
};

const DEED_GLYPHS: Record<AuditNamespace, LucideIcon> = {
  run: Play,
  git: GitCommitHorizontal,
  agent: Bot,
  intake: Inbox,
  work_item: SquarePen,
  session: MessageSquare,
};

function entryTone(entry: ActivityEntry): BadgeVariant {
  return entry.kind === 'move'
    ? stageTone(entry.stages.at(-1) ?? 'triage')
    : (auditCategory(entry.action)?.tone ?? 'neutral');
}

function entryGlyph(entry: ActivityEntry): LucideIcon {
  if (entry.kind === 'move') return STAGE_GLYPHS[entry.stages.at(-1) ?? ''] ?? ListFilter;
  const namespace = parseAuditAction(entry.action)?.namespace;
  return namespace ? DEED_GLYPHS[namespace] : SquarePen;
}

export function EntryNode({ entry }: { entry: ActivityEntry }) {
  const Glyph = entryGlyph(entry);

  return <Glyph size={14} className={RAIL_MARK_TONE[entryTone(entry)]} aria-hidden />;
}
