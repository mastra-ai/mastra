import type { DatasetItem } from '@mastra/client-js';
import {
  BracesIcon,
  FileInputIcon,
  FileOutputIcon,
  ListChecksIcon,
  RouteIcon,
  TagIcon,
  WrenchIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

export interface DatasetItemSection {
  key: string;
  title: string;
  icon: ReactNode;
  /** Serialized value of the field; `undefined` when the field is absent on this item. */
  value: (item: DatasetItem) => string | undefined;
}

const toJson = (value: unknown) => JSON.stringify(value ?? null, null, 2);

/** Ordered list of code sections shown for a dataset item; shared by details and diff views. */
export const datasetItemSections: DatasetItemSection[] = [
  { key: 'input', title: 'Input', icon: <FileInputIcon />, value: item => toJson(item.input) },
  { key: 'groundTruth', title: 'Ground Truth', icon: <FileOutputIcon />, value: item => toJson(item.groundTruth) },
  {
    key: 'expectedTrajectory',
    title: 'Expected Trajectory',
    icon: <RouteIcon />,
    value: item => (item.expectedTrajectory != null ? toJson(item.expectedTrajectory) : undefined),
  },
  { key: 'toolMocks', title: 'Tool Mocks', icon: <WrenchIcon />, value: item => toJson(item.toolMocks ?? []) },
  {
    key: 'scorerIds',
    title: 'Scorers',
    icon: <ListChecksIcon />,
    value: item => (item.scorerIds === undefined ? 'Inherited from dataset' : toJson(item.scorerIds)),
  },
  {
    key: 'requestContext',
    title: 'Request Context',
    icon: <BracesIcon />,
    value: item => (item.requestContext != null ? toJson(item.requestContext) : undefined),
  },
  { key: 'metadata', title: 'Metadata', icon: <TagIcon />, value: item => toJson(item.metadata) },
];
