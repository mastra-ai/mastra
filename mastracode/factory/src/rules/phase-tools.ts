import { boardForWorkItem } from '../boards/index.js';
import type { BoardRegistry, FactoryPhaseTool } from '../boards/index.js';
import { toBoardSource } from '../boards/project-boards.js';
import type { ProjectBoardSource } from '../boards/project-boards.js';
import type { Card, FactoryRunBindingRecord } from '../storage/domains/work-items/base.js';

/**
 * Whether the card's current phase grants `tool` to the session bound by `binding`: the
 * phase lists the tool, and the session works the card there (its context is the phase's
 * runner context). A session whose card moved on to a phase without the tool, or that
 * works the card in another context, does not get it.
 */
export async function phaseGrantsTool(
  boards: BoardRegistry | ProjectBoardSource | undefined,
  binding: Pick<FactoryRunBindingRecord, 'orgId' | 'factoryProjectId' | 'role'>,
  item: Pick<Card, 'board' | 'stages'>,
  tool: FactoryPhaseTool,
): Promise<boolean> {
  if (item.stages.length !== 1) return false;
  const board = (await toBoardSource(boards).load(binding)).get(boardForWorkItem(item));
  const phase = board?.phases[item.stages[0]!];
  if (phase?.kind !== 'working') return false;
  return phase.runner.context === binding.role && phase.tools?.includes(tool) === true;
}
