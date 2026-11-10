import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Settings2 } from 'lucide-react';
import { Link } from 'react-router';

import { settingsSectionPath } from '../../settings/settingsSections';

export function BoardAutomationSettings({ factoryProjectId }: { factoryProjectId: string }) {
  return (
    <Popover>
      <PopoverTrigger variant="default" size="icon-sm" aria-label="Automation settings" tooltip="Automation settings">
        <Settings2 aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)]" aria-label="Automation settings">
        <div className="flex flex-col gap-1">
          <Txt as="h2" variant="subheading">
            Automation
          </Txt>
          <Txt variant="caption" tone="muted">
            The board&apos;s phases decide which runs start on their own and whether cards get a self-review.{' '}
            <Link to={settingsSectionPath(factoryProjectId, 'board')} className="underline underline-offset-2">
              Edit the Work board
            </Link>
          </Txt>
        </div>
      </PopoverContent>
    </Popover>
  );
}
