import type { DatasetItem } from '@mastra/client-js';
import { BracesIcon, FileInputIcon, FileOutputIcon, RouteIcon, TagIcon, WrenchIcon } from 'lucide-react';
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
    icon: <FileInputIcon />,
    value: item => toJson(item.input),
    payload: item => item.input,
  },
  {
    key: 'groundTruth',
    title: 'Ground Truth',
    icon: <FileOutputIcon />,
    value: item => (isEmptyPayload(item.groundTruth) ? undefined : toJson(item.groundTruth)),
    payload: item => (isEmptyPayload(item.groundTruth) ? null : item.groundTruth),
  },
  {
    key: 'expectedTrajectory',
    title: 'Expected Trajectory',
    icon: <RouteIcon />,
    value: item => (item.expectedTrajectory != null ? toJson(item.expectedTrajectory) : undefined),
  },
  {
    key: 'toolMocks',
    title: 'Tool Mocks',
    icon: <WrenchIcon />,
    value: item => (item.toolMocks?.length ? toJson(item.toolMocks) : undefined),
  },
  {
    key: 'requestContext',
    title: 'Request Context',
    icon: <BracesIcon />,
    value: item => (item.requestContext != null ? toJson(item.requestContext) : undefined),
  },
  { key: 'metadata', title: 'Metadata', icon: <TagIcon />, value: item => toJson(item.metadata) },
];
