import type { DataPart, MessageFactoryPart } from '@mastra/react';

import { isToolPart, readToolPart } from '../messages/renderers/tool-part';
import type { ToolPart } from '../messages/renderers/tool-part';
import { isSignalData } from '../messages/signal-data';
import { toolCardKind, toolInteraction } from './tool-card-kind';
import type { ToolCardContext, ToolCardKind } from './tool-card-kind';
import { groupConsecutive } from '@/ds/components/ai/tool-call';
import type { ConsecutiveGroups } from '@/ds/components/ai/tool-call';

/** Cards that only draw: nothing in them waits on the reader. */
const FOLDABLE_KINDS = new Set<ToolCardKind>(['plain', 'background', 'file_tree', 'sandbox', 'code_mode']);

export function foldsIntoGroup(part: ToolPart, context: ToolCardContext): boolean {
  const fields = readToolPart(part);
  if (fields.toolCallId === '' || !FOLDABLE_KINDS.has(toolCardKind(fields, context))) return false;
  const { approval, suspended } = toolInteraction(context.metadata, fields.toolName, fields.toolCallId);
  return approval === undefined && suspended === undefined;
}

const isDataPart = (part: MessageFactoryPart): part is DataPart => part.type.startsWith('data-');

/** Mirrors the renderers: step markers, non-signal data and hidden tools put nothing on screen. */
const drawsNothing = (part: MessageFactoryPart, context: ToolCardContext): boolean => {
  if (part.type === 'step-start') return true;
  if (isDataPart(part)) return !(part.type === 'data-signal' && isSignalData(part.data));
  return isToolPart(part) && toolCardKind(readToolPart(part), context) === 'hidden';
};

/** Runs of plain calls fold under their first call id. A part that draws nothing neither joins nor breaks a run. */
export function collectToolGroups(
  parts: readonly MessageFactoryPart[],
  context: ToolCardContext,
): ConsecutiveGroups<ToolPart> {
  return groupConsecutive(
    parts.filter(part => !drawsNothing(part, context)),
    {
      key: part => readToolPart(part).toolCallId,
      joins: (part): part is ToolPart => isToolPart(part) && foldsIntoGroup(part, context),
    },
  );
}
