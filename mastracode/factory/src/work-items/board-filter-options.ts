import type { WorkItemFilterOptionsResponse } from '../routes/contracts.js';
import type { Card } from '../storage/domains/work-items/base.js';
import { cardFacts } from './card-facts.js';
import type { ProviderPerson } from './card-people.js';

// One answer per list version: `listShared` returns the same array until a card changes.
const optionsByList = new WeakMap<readonly Card[], WorkItemFilterOptionsResponse>();

/** What the board's filter menus offer, read over every card of the project's `list`. */
export function workItemFilterOptions(list: readonly Card[]): WorkItemFilterOptionsResponse {
  let options = optionsByList.get(list);
  if (options) return options;
  const labels = new Set<string>();
  const people = new Map<string, ProviderPerson>();
  const actorIds = new Set<string>();
  for (const card of list) {
    const facts = cardFacts(card);
    for (const label of facts.labels) labels.add(label);
    for (const actorId of facts.humanActorIds) actorIds.add(actorId);
    for (const named of Object.values(facts.people)) {
      for (const person of named) {
        // One person is named with the casing of the first card that names them.
        if (!people.has(person.id)) people.set(person.id, person);
      }
    }
  }
  options = {
    labels: [...labels].sort((left, right) => left.localeCompare(right)),
    people: [...people.values()].sort(
      (left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id),
    ),
    actorIds: [...actorIds].sort(),
  };
  optionsByList.set(list, options);
  return options;
}
