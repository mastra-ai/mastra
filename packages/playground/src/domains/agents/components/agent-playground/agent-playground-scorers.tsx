import { Badge } from '@mastra/playground-ui/components/Badge';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@mastra/playground-ui/components/InputGroup';
import { Label } from '@mastra/playground-ui/components/Label';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { Calculator, CheckCircle2, Loader2, SearchIcon } from 'lucide-react';
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
    <div className="flex h-full flex-col">
      <div className="border-border1 space-y-2 border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <Txt variant="ui-sm" className="text-neutral3">
            Toggle scorers to evaluate agent responses during experiments.
            {selectedCount > 0 && ` (${selectedCount} active)`}
          </Txt>
        </div>
        {scorerList.length > 5 && (
          <InputGroup variant="outline">
            <InputGroupAddon align="inline-start">
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              aria-label="Search scorers"
              placeholder="Search scorers..."
              onChange={event => setSearch(event.target.value)}
            />
          </InputGroup>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-2 p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="text-neutral3 h-5 w-5 animate-spin" />
            </div>
          ) : filteredScorers.length === 0 ? (
            <div className="space-y-3 py-12 text-center">
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
                  className="border-border1 hover:bg-surface2 rounded-lg border p-3 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Txt variant="ui-sm" className="text-neutral5 truncate font-medium">
                          {scorer.name}
                        </Txt>
                        {scorer.isRegistered && (
                          <Badge variant="default">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
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
                    <div className="flex shrink-0 items-center gap-2 pt-0.5">
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
