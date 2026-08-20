import { MainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { Flag } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { useQueueHealth } from '../../../../hooks/useQueueHealth';
import { attentionRows, needsPerson } from '../attention';
import { AttentionList } from './AttentionList';

/** Past this the popover stops being a glance; the Overview holds the rest. */
const GLANCE = 8;

/**
 * What the board is waiting on a person for, reachable from any page. A window
 * onto the queue rather than an inbox: no read state and nothing to dismiss, so
 * the badge can never drift from what the board actually holds.
 */
export function NeedsYouButton({ factoryId }: { factoryId: string }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { health } = useQueueHealth(factoryId);

  const rows = attentionRows(health);
  const waiting = rows.filter(needsPerson);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <MainSidebar.NavLink asChild link={{ name: 'Needs you', url: '#', icon: <Flag /> }} isActive={open}>
        <PopoverTrigger aria-label={`Needs you — ${waiting.length} waiting on a person`}>
          <Flag />
          <MainSidebar.NavLabel>Needs you</MainSidebar.NavLabel>
          {waiting.length > 0 ? (
            <span className="bg-surface5 text-icon4 text-ui-xs ml-auto rounded-full px-1.5 py-0.5 tabular-nums">
              {waiting.length}
            </span>
          ) : null}
        </PopoverTrigger>
      </MainSidebar.NavLink>

      <PopoverContent side="right" align="end" className="w-96 p-2">
        <AttentionList rows={rows} limit={GLANCE} />
        {rows.length > GLANCE ? (
          <button
            type="button"
            className="text-ui-xs text-icon3 hover:text-icon5 w-full cursor-pointer px-2 py-1.5 text-left"
            onClick={() => {
              setOpen(false);
              void navigate(`/factories/${factoryId}/overview`);
            }}
          >
            {rows.length - GLANCE} more on the Overview
          </button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
