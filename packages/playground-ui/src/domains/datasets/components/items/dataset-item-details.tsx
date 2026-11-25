'use client';

import type { DatasetItem } from '@mastra/client-js';
import { datasetItemSections } from './dataset-item-sections';
import { ComparisonMetricList } from '@/domains/experiments/components/comparison/comparison-metric-list';
import type { ComparisonMetric } from '@/domains/experiments/components/comparison/comparison-metric-list';
import { ComparisonPayload } from '@/domains/experiments/components/comparison/comparison-payload';
import { ComparisonSection, sectionStackClass } from '@/domains/experiments/components/comparison/comparison-section';
import { CopyButton } from '@/ds/components/CopyButton';
import { DataPanel } from '@/ds/components/DataPanel';
import { Txt } from '@/ds/components/Txt';
import { IconCalendar1 } from '@/ds/icons/central/IconCalendar1';
import { IconCalendarClock4 } from '@/ds/icons/central/IconCalendarClock4';
import { IconFingerPrint1 } from '@/ds/icons/central/IconFingerPrint1';
import { formatDate } from '@/utils/date-format';
import { getShortId } from '@/utils/id';

export interface DatasetItemDetailsProps {
  item: DatasetItem;
  /** When set, each code section highlights the lines that differ from the same field on `against`. */
  diff?: { against: DatasetItem; side: 'a' | 'b' };
}

/**
 * Read-only details of a dataset item: metadata key/values plus code sections.
 * Shared by the item side panel and the version/item compare views.
 */
export function DatasetItemDetails({ item, diff }: DatasetItemDetailsProps) {
  return (
    <div className={sectionStackClass}>
      <ComparisonMetricList metrics={metadataMetrics(item)} />

      {datasetItemSections.map(section => {
        // Outside diffs, payloads read like experiment results; diffs keep the code view for line highlighting.
        if (section.payload && !diff) {
          const payload = section.payload(item);
          if (payload == null) return null;
          return (
            <ComparisonSection
              key={section.key}
              title={section.title}
              framed
              actions={
                <CopyButton content={typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2)} />
              }
            >
              <ComparisonPayload value={payload} />
            </ComparisonSection>
          );
        }
        const codeStr = section.value(item);
        const againstStr = diff ? section.value(diff.against) : undefined;
        // In diff mode keep a section that only exists on the other side so the addition/removal stays visible.
        if (codeStr === undefined && againstStr === undefined) return null;
        if (codeStr === undefined) {
          return (
            <div key={section.key} className="flex flex-col gap-2">
              <DataPanel.SectionHeading icon={section.icon}>{section.title}</DataPanel.SectionHeading>
              <Txt as="p" variant="body" tone="muted">
                Not set in this version
              </Txt>
            </div>
          );
        }
        return (
          <DataPanel.CodeSection
            key={section.key}
            title={section.title}
            icon={section.icon}
            codeStr={codeStr}
            diff={diff ? { against: againstStr ?? '', side: diff.side } : undefined}
          />
        );
      })}
    </div>
  );
}

/** Item id and timestamps, laid out like the experiment result metadata. */
function metadataMetrics(item: DatasetItem): ComparisonMetric[] {
  const wasUpdated = item.updatedAt && new Date(item.updatedAt).getTime() !== new Date(item.createdAt).getTime();
  const metrics: ComparisonMetric[] = [
    {
      id: 'item-id',
      icon: <IconFingerPrint1 />,
      label: 'Item Id',
      value: (
        <span className="flex items-center gap-1.5">
          <span className="font-mono" title={item.id}>
            {getShortId(item.id)}
          </span>
          <CopyButton content={item.id} tooltip="Copy item ID to clipboard" variant="link" />
        </span>
      ),
      delta: null,
    },
    {
      id: 'created',
      icon: <IconCalendar1 />,
      label: 'Created',
      value: formatDate(item.createdAt, 'date-time'),
      delta: null,
    },
  ];
  if (wasUpdated) {
    metrics.push({
      id: 'updated',
      icon: <IconCalendarClock4 />,
      label: 'Updated',
      value: formatDate(item.updatedAt, 'date-time'),
      delta: null,
    });
  }
  return metrics;
}
