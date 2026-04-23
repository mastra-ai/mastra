import { IconButton, Txt } from '@mastra/playground-ui';
import { ArrowLeftIcon } from 'lucide-react';
import { useNavigate } from 'react-router';

export const ConversationHeader = () => {
  const navigate = useNavigate();

  return (
    <>
      <IconButton onClick={() => navigate('/agent-builder/agents')} className="rounded-full" tooltip="Agents list">
        <ArrowLeftIcon />
      </IconButton>

      <div className="flex shrink-0 items-center py-3">
        <Txt variant="ui-xs" className="font-medium uppercase tracking-wider text-neutral3">
          Builder
        </Txt>
      </div>
    </>
  );
};
