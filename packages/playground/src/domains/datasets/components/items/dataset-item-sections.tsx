import type { DatasetItem } from '@mastra/client-js';
import { IconCodeBrackets } from '@mastra/playground-ui/icons/central/IconCodeBrackets';
import { IconDirection1 } from '@mastra/playground-ui/icons/central/IconDirection1';
import { IconFileArrowRightIn } from '@mastra/playground-ui/icons/central/IconFileArrowRightIn';
import { IconFileArrowRightOut } from '@mastra/playground-ui/icons/central/IconFileArrowRightOut';
import { IconMaintenance } from '@mastra/playground-ui/icons/central/IconMaintenance';
import { IconTag } from '@mastra/playground-ui/icons/central/IconTag';
import type { ReactNode } from 'react';

export interface DatasetItemSection {
  key: string;
  title: string;
  icon: ReactNode;
  /** Serialized value of the field; `undefined` when the field is absent on this item. */
  value: (item: DatasetItem) => string | undefined;
  /** Raw field for payloads (input, ground truth), rendered like experiment results: strings as markdown, anything else as JSON. */
  payload?: (item: DatasetItem) => unknown;
}

const toJson = (value: unknown) => JSON.stringify(value ?? null, null, 2);

/** True for a payload that carries nothing to show: null, undefined, '' or `{}`. */
const isEmptyPayload = (value: unknown) =>
  value == null ||
  value === '' ||
  (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0);

/** Ordered list of code sections shown for a dataset item; shared by details and diff views. */
export const datasetItemSections: DatasetItemSection[] = [
  {
    key: 'input',
    title: 'Input',
    icon: <IconFileArrowRightIn />,
    value: item => toJson(item.input),
    payload: item => item.input,
  },
  {
    key: 'groundTruth',
    title: 'Ground Truth',
    icon: <IconFileArrowRightOut />,
    value: item => (isEmptyPayload(item.groundTruth) ? undefined : toJson(item.groundTruth)),
    payload: item => (isEmptyPayload(item.groundTruth) ? null : item.groundTruth),
  },
  {
    key: 'expectedTrajectory',
    title: 'Expected Trajectory',
    icon: <IconDirection1 />,
    value: item => (item.expectedTrajectory != null ? toJson(item.expectedTrajectory) : undefined),
  },
  {
    key: 'toolMocks',
    title: 'Tool Mocks',
    icon: <IconMaintenance />,
    value: item => (item.toolMocks?.length ? toJson(item.toolMocks) : undefined),
  },
  {
    key: 'requestContext',
    title: 'Request Context',
    icon: <IconCodeBrackets />,
    value: item => (item.requestContext != null ? toJson(item.requestContext) : undefined),
  },
  { key: 'metadata', title: 'Metadata', icon: <IconTag />, value: item => toJson(item.metadata) },
];
