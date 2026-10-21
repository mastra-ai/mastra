import type { AddDatasetItemParams, DatasetItemToolMock } from '@mastra/client-js';
import { isToolStepType } from './trajectory-types';
import type { ExpectedStep, TrajectoryOrdering, TrajectoryStepRow } from './trajectory-types';

export type AddItemField = 'input' | 'groundTruth' | 'toolMocks' | 'requestContext' | 'expectedTrajectory';

export interface AddItemError {
  field: AddItemField;
  message: string;
}

export interface AddItemDraft {
  input: string;
  groundTruth: string;
  /** Raw JSON: an ordered array of mocks, sent as written so every mock the runtime supports can be declared. */
  toolMocks: string;
  requestContextEnabled: boolean;
  /** Raw JSON object of values passed to the target. */
  requestContext: string;
  trajectoryEnabled: boolean;
  ordering: TrajectoryOrdering;
  trajectorySteps: TrajectoryStepRow[];
}

export type AddItemParams = Omit<AddDatasetItemParams, 'datasetId'>;

type JsonResult = { ok: true; value: unknown } | { ok: false };

const parseJson = (raw: string): JsonResult => {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Blank sends nothing; anything else must be a JSON object. */
const parseOptionalObject = (raw: string): { ok: true; value?: Record<string, unknown> } | { ok: false } => {
  if (!raw.trim()) return { ok: true };
  const parsed = parseJson(raw);
  if (!parsed.ok || !isRecord(parsed.value)) return { ok: false };
  return { ok: true, value: parsed.value };
};

const isToolMock = (value: unknown): value is DatasetItemToolMock =>
  isRecord(value) && typeof value.toolName === 'string' && isRecord(value.args);

/** Blank sends nothing; anything else must be a JSON array of `{ toolName, args, output }` mocks. */
function parseToolMocks(raw: string): { toolMocks?: DatasetItemToolMock[] } | { message: string } {
  if (!raw.trim()) return {};
  const parsed = parseJson(raw);
  if (!parsed.ok) return { message: 'Tool mocks must be valid JSON' };
  if (!Array.isArray(parsed.value)) return { message: 'Tool mocks must be a JSON array' };
  if (!parsed.value.every(isToolMock))
    return { message: 'Each tool mock needs a "toolName" string and an "args" object' };
  return parsed.value.length > 0 ? { toolMocks: parsed.value } : {};
}

function toExpectedStep(row: TrajectoryStepRow, index: number): { step: ExpectedStep } | { message: string } {
  const label = `Step ${index + 1}`;
  const name = row.name.trim();
  if (!name) return { message: `${label} needs a name` };

  // Only tool steps have expected args; any other type parses blank and sends none.
  const toolArgs = parseOptionalObject(isToolStepType(row.stepType) ? row.toolArgs : '');
  if (!toolArgs.ok) return { message: `The expected args of ${label.toLowerCase()} must be a JSON object` };
  const args = toolArgs.value ? { toolArgs: toolArgs.value } : {};

  // A prefilled row keeps its recorded details; the editor's name and args replace the recorded ones.
  const { recorded } = row;
  if (recorded?.stepType === 'tool_call' || recorded?.stepType === 'mcp_tool_call') {
    const { toolArgs: _recordedArgs, ...details } = recorded;
    return { step: { ...details, name, ...args } };
  }
  if (recorded) return { step: { ...recorded, name } };

  if (row.stepType === 'generic') return { step: { name } };
  if (!isToolStepType(row.stepType)) return { step: { name, stepType: row.stepType } };
  return { step: { name, stepType: row.stepType, ...args } };
}

/** The request body for the dialog, or the first error with the field that owns it. Options that are off are left out. */
export function buildAddItemPayload(draft: AddItemDraft): { params: AddItemParams } | { error: AddItemError } {
  const input = parseJson(draft.input);
  if (!input.ok) return { error: { field: 'input', message: 'Input must be valid JSON' } };
  const params: AddItemParams = { input: input.value };

  if (draft.groundTruth.trim()) {
    const groundTruth = parseJson(draft.groundTruth);
    if (!groundTruth.ok) return { error: { field: 'groundTruth', message: 'Ground truth must be valid JSON' } };
    params.groundTruth = groundTruth.value;
  }

  const toolMocks = parseToolMocks(draft.toolMocks);
  if ('message' in toolMocks) return { error: { field: 'toolMocks', message: toolMocks.message } };
  if (toolMocks.toolMocks) params.toolMocks = toolMocks.toolMocks;

  if (draft.requestContextEnabled) {
    const requestContext = parseOptionalObject(draft.requestContext);
    if (!requestContext.ok)
      return { error: { field: 'requestContext', message: 'Request context must be a JSON object' } };
    if (requestContext.value) params.requestContext = requestContext.value;
  }

  if (draft.trajectoryEnabled && draft.trajectorySteps.length > 0) {
    const steps: ExpectedStep[] = [];
    for (const [index, row] of draft.trajectorySteps.entries()) {
      const result = toExpectedStep(row, index);
      if ('message' in result) return { error: { field: 'expectedTrajectory', message: result.message } };
      steps.push(result.step);
    }
    params.expectedTrajectory = { ordering: draft.ordering, steps };
  }

  return { params };
}
