import { usePromptVersions } from '@/domains/agents/hooks/use-prompt-versions';
import { useAgent } from '@/hooks/use-agents';
import { cn } from '@/lib/utils';
import { EntryList, EntryListPageHeader, MainContentLayout, AgentVersionDialog } from '@mastra/playground-ui';
import { useParams } from 'react-router';
import { format } from 'date-fns';
import { useState } from 'react';

export default function AgentVersionsPage() {
  const { agentId } = useParams();
  const { data: agent, isLoading: isAgentLoading } = useAgent(agentId!);
  const [dialogIsOpen, setDialogIsOpen] = useState<boolean>(false);
  const [selectedVersion, setSelectedVersion] = useState<any>(null);

  const { versions } = usePromptVersions(agentId, agent?.instructions);

  const listColumns = [
    { name: 'instructions', label: 'Instructions', size: '1fr' },
    { name: 'tag', label: 'Tag', size: '9rem' },
    { name: 'createdAt', label: 'Created at', size: '7rem' },
  ];

  const agentVersions = versions.map(version => ({
    id: format(version.timestamp, 'MMM d HH:mm aa'),
    instructions: version.content,
    createdAt: format(version.timestamp, 'MMM d HH:mm aa'),
    tag: version.tag,
  }));

  console.log({ versions });

  const handleOnListItem = (val: any) => {
    console.log({ val });

    if (val.id === selectedVersion?.id) {
      setSelectedVersion(null);
    } else {
      setSelectedVersion(val);
      setDialogIsOpen(true);
    }
  };

  return (
    <>
      <MainContentLayout>
        <div className={cn(`h-full overflow-y-scroll `)}>
          <div className={cn('max-w-[100rem] px-[3rem] mx-auto grid')}>
            <EntryListPageHeader title="Versions" description={'Versions of the agent prompt and settings'} />
            <EntryList
              items={agentVersions}
              selectedItem={null}
              onItemClick={handleOnListItem}
              columns={listColumns}
              isLoading={false}
            />
          </div>
        </div>
      </MainContentLayout>
      <AgentVersionDialog isOpen={dialogIsOpen} version={selectedVersion} onClose={() => setDialogIsOpen(false)} />
    </>
  );
}
