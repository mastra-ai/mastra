import { SideDialog, type SideDialogRootProps } from '@/ds/components/SideDialog';
import { TextAndIcon, getShortId } from '@/ds/components/Text';
import { KeyValueList } from '@/ds/components/KeyValueList';
import { Sections } from '@/ds/components/Sections';
import { useLinkComponent } from '@/lib/framework';
import { Tabs } from '@/ds/components/Tabs/tabs-root';
import { TabList } from '@/ds/components/Tabs/tabs-list';
import { Tab } from '@/ds/components/Tabs/tabs-tab';
import { TabContent } from '@/ds/components/Tabs/tabs-content';
import { Table, Thead, Th, Tbody, Row, TxtCell, Cell } from '@/ds/components/Table';
import {
  HashIcon,
  FileInputIcon,
  FileOutputIcon,
  ClockIcon,
  AlertCircleIcon,
  GaugeIcon,
  RouteIcon,
} from 'lucide-react';
import { format } from 'date-fns/format';
import type { ScoreData, RunResultData } from './results-table';

interface ResultDetailDialogProps {
  result: RunResultData;
  scores: ScoreData[];
  isOpen: boolean;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  dialogLevel?: SideDialogRootProps['level'];
}

/**
 * Side dialog showing full details of a single run result.
 * Includes tabs for Input, Output, and Scores (if applicable).
 */
export function ResultDetailDialog({
  result,
  scores,
  isOpen,
  onClose,
  onNext,
  onPrevious,
  dialogLevel = 1,
}: ResultDetailDialogProps) {
  const { Link } = useLinkComponent();
  const hasScores = scores.length > 0;
  const hasError = result.error !== null;

  return (
    <SideDialog
      dialogTitle="Result Details"
      dialogDescription={`Item: ${result.itemId}`}
      isOpen={isOpen}
      onClose={onClose}
      level={dialogLevel}
    >
      <SideDialog.Top>
        <TextAndIcon>
          <HashIcon /> {getShortId(result.id)}
        </TextAndIcon>
        |
        <SideDialog.Nav onNext={onNext} onPrevious={onPrevious} />
      </SideDialog.Top>

      <SideDialog.Content>
        <SideDialog.Header>
          <SideDialog.Heading>
            <FileInputIcon /> Result
          </SideDialog.Heading>
          <TextAndIcon>
            <HashIcon /> {result.itemId}
          </TextAndIcon>
        </SideDialog.Header>

        <Sections>
          {/* Metadata section */}
          <KeyValueList
            data={[
              {
                label: 'Item ID',
                value: result.itemId,
                key: 'itemId',
              },
              {
                label: 'Latency',
                value: `${result.latency}ms`,
                key: 'latency',
              },
              ...(result.traceId
                ? [
                    {
                      label: 'Trace',
                      value: (
                        <Link
                          href={`/observability?traceId=${result.traceId}`}
                          className="text-accent1 hover:underline inline-flex items-center gap-1"
                        >
                          <RouteIcon className="w-3 h-3" />
                          View Trace
                        </Link>
                      ),
                      key: 'trace',
                    },
                  ]
                : []),
              {
                label: 'Started',
                value: format(new Date(result.startedAt), 'MMM d, h:mm:ss aaa'),
                key: 'startedAt',
              },
              {
                label: 'Completed',
                value: format(new Date(result.completedAt), 'MMM d, h:mm:ss aaa'),
                key: 'completedAt',
              },
              {
                label: 'Retry Count',
                value: String(result.retryCount),
                key: 'retryCount',
              },
            ]}
            LinkComponent={Link}
          />

          {/* Tabs for Input/Output/Scores */}
          <Tabs defaultTab="input" className="w-full">
            <TabList>
              <Tab value="input">Input</Tab>
              <Tab value="output">Output</Tab>
              {hasScores && <Tab value="scores">Scores</Tab>}
              {hasError && <Tab value="error">Error</Tab>}
            </TabList>

            <TabContent value="input">
              <SideDialog.CodeSection
                title="Input"
                icon={<FileInputIcon />}
                codeStr={JSON.stringify(result.input, null, 2)}
              />
            </TabContent>

            <TabContent value="output">
              <SideDialog.CodeSection
                title="Output"
                icon={<FileOutputIcon />}
                codeStr={JSON.stringify(result.output, null, 2)}
              />
              {result.expectedOutput !== null && result.expectedOutput !== undefined && (
                <SideDialog.CodeSection
                  title="Expected Output"
                  icon={<FileOutputIcon />}
                  codeStr={JSON.stringify(result.expectedOutput, null, 2)}
                />
              )}
            </TabContent>

            {hasScores && (
              <TabContent value="scores">
                <div className="py-4">
                  <Table size="small">
                    <Thead>
                      <Th>Scorer</Th>
                      <Th>Score</Th>
                      <Th>Reason</Th>
                    </Thead>
                    <Tbody>
                      {scores.map(score => (
                        <Row key={score.id}>
                          <TxtCell>{score.scorerId}</TxtCell>
                          <TxtCell>{score.score !== null ? score.score.toFixed(2) : '-'}</TxtCell>
                          <TxtCell>{score.reason || '-'}</TxtCell>
                        </Row>
                      ))}
                    </Tbody>
                  </Table>
                </div>
              </TabContent>
            )}

            {hasError && (
              <TabContent value="error">
                <SideDialog.CodeSection
                  title="Error"
                  icon={<AlertCircleIcon />}
                  codeStr={result.error || 'null'}
                  simplified={true}
                />
              </TabContent>
            )}
          </Tabs>
        </Sections>
      </SideDialog.Content>
    </SideDialog>
  );
}
