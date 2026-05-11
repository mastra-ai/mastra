import { Badge, Label, ScrollArea, Searchbar, Switch, Txt, Icon } from '@mastra/playground-ui';
import { Calculator, CheckCircle2, Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useWatch } from 'react-hook-form';
import { useAgentEditFormContext } from '../../context/agent-edit-form-context';
import { useScorers } from '@/domains/scores/hooks/use-scorers';

interface AgentPlaygroundScorersProps {
  agentId: string;
}

export function AgentPlaygroundScorers(_props: AgentPlaygroundScorersProps) {
  const { form, readOnly } = useAgentEditFormContext();
  const { control } = form;
  const { data: scorers, isLoading } = useScorers();
  const selectedScorers = useWatch({ control, name: 'scorers' });
  const [search, setSearch] = useState('');

  const scorerList = useMemo(() => {
    if (!scorers) return [];
    return Object.entries(scorers).map(([id, scorer]) => ({
      id,
      name: (scorer as { scorer?: { config?: { name?: string } } }).scorer?.config?.name || id,
      description: (scorer as { scorer?: { config?: { description?: string } } }).scorer?.config?.description || '',
      isRegistered: (scorer as { isRegistered?: boolean }).isRegistered ?? false,
    }));
  }, [scorers]);

  const selectedScorerIds = Object.keys(selectedScorers || {});
  const selectedCount = selectedScorerIds.length;

  const filteredScorers = useMemo(() => {
    if (!search) return scorerList;
    return scorerList.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
  }, [scorerList, search]);

  const handleToggle = (scorerId: string, description: string) => {
    if (readOnly) return;
    const isSet = selectedScorers?.[scorerId] !== undefined;
    if (isSet) {
      const next = { ...selectedScorers };
      delete next[scorerId];
      form.setValue('scorers', next, { shouldDirty: true });
    } else {
      form.setValue(
        'scorers',
        {
          ...selectedScorers,
          [scorerId]: { description },
        },
        { shouldDirty: true },
      );
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border1 space-y-2">
        <div className="flex items-center justify-between">
          <Txt variant="ui-sm" className="text-neutral3">
            Toggle scorers to evaluate agent responses during experiments.
            {selectedCount > 0 && ` (${selectedCount} active)`}
          </Txt>
        </div>
        {scorerList.length > 5 && (
          <Searchbar onSearch={setSearch} label="Search scorers" placeholder="Search scorers..." />
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-neutral3" />
            </div>
          ) : filteredScorers.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <Icon size="lg" className="text-neutral3 mx-auto">
                <Calculator />
              </Icon>
              <div>
                <Txt variant="ui-sm" className="text-neutral3">
                  {search ? 'No scorers match your search' : 'No scorers available'}
                </Txt>
                <Txt variant="ui-xs" className="text-neutral3 mt-1">
                  {search
                    ? 'Try a different search term.'
                    : 'Create scorers in your Mastra config or through the Scorers page.'}
                </Txt>
              </div>
            </div>
          ) : (
            filteredScorers.map(scorer => {
              const isActive = selectedScorerIds.includes(scorer.id);
              return (
                <div
                  key={scorer.id}
                  className="border border-border1 rounded-lg p-3 hover:bg-surface2 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Txt variant="ui-sm" className="text-neutral5 font-medium truncate">
                          {scorer.name}
                        </Txt>
                        {scorer.isRegistered && (
                          <Badge variant="default">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Registered
                          </Badge>
                        )}
                      </div>
                      {scorer.description && (
                        <Txt variant="ui-xs" className="text-neutral3 mt-0.5 line-clamp-2">
                          {scorer.description}
                        </Txt>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 pt-0.5">
                      <Label htmlFor={`scorer-${scorer.id}`} className="sr-only">
                        Toggle {scorer.name}
                      </Label>
                      <Switch
                        id={`scorer-${scorer.id}`}
                        checked={isActive}
                        onCheckedChange={() => handleToggle(scorer.id, scorer.description)}
                        disabled={readOnly}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
