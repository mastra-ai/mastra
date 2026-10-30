import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Plus } from 'lucide-react';
import { useState } from 'react';

import { NewJiraFactoryFields } from './NewJiraFactoryFields';
import type { NewJiraRoute } from './NewJiraFactoryFields';
import type { Factory } from './routing';

/** Routes a Jira project to one more factory, with the board and labels it starts with. */
export function AddJiraFactory({
  project,
  unbound,
  anotherTakesAll,
  errors,
  saving,
  onAdd,
}: {
  project: string;
  unbound: Factory[];
  anotherTakesAll: boolean;
  errors: Record<string, string>;
  saving: boolean;
  onAdd: (route: NewJiraRoute, onAdded: () => void) => void;
}) {
  const [factoryProjectId, setFactoryProjectId] = useState<string>();
  const factory = unbound.find(candidate => candidate.id === factoryProjectId);

  return (
    <li className="flex flex-col gap-1">
      <Select value={factory?.id ?? ''} disabled={saving} onValueChange={setFactoryProjectId}>
        <SelectTrigger size="sm" aria-label={`Factory to add for ${project}`} className="w-fit max-w-full min-w-0">
          <Txt as="span" variant="caption" className="flex items-center gap-1">
            {factory ? (
              factory.name
            ) : (
              <>
                <Plus className="size-3.5" aria-hidden />
                Add factory
              </>
            )}
          </Txt>
        </SelectTrigger>
        <SelectContent>
          {unbound.map(candidate => (
            <SelectItem key={candidate.id} value={candidate.id}>
              {candidate.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {factory && (
        <NewJiraFactoryFields
          key={factory.id}
          project={project}
          factory={factory}
          anotherTakesAll={anotherTakesAll}
          error={errors[factory.id]}
          saving={saving}
          onAdd={route => onAdd(route, () => setFactoryProjectId(undefined))}
        />
      )}
    </li>
  );
}
