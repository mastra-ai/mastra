import { safeStringify } from '@mastra/core/utils/safe-stringify';
import { ArrowDownToLine, ArrowUpFromLine, Braces, ChevronRight, Database } from 'lucide-react';
import { useState } from 'react';
import type { WorkflowRunStreamResult } from '../context/workflow-run-context';
import { CodeEditor } from '@/ds/components/CodeEditor';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/ds/components/Collapsible';
import { Tabs, TabList, Tab, TabContent } from '@/ds/components/Tabs';
import { Txt } from '@/ds/components/Txt';

type RunDataTab = 'input' | 'output' | 'execution';

function RunDataValue({ value }: { value: unknown }) {
  if (value === undefined) {
    return (
      <Txt className="block p-4" variant="caption" tone="muted">
        No input recorded
      </Txt>
    );
  }
  return (
    <CodeEditor
      value={safeStringify(value, 2)}
      editable={false}
      lineNumbers={false}
      className="max-h-72 overflow-auto rounded-lg border border-border bg-background p-3"
    />
  );
}

export function WorkflowRunData({ input, result }: { input: unknown; result: WorkflowRunStreamResult }) {
  const output = 'result' in result ? result.result : undefined;
  const hasOutput = output !== undefined;
  const [selectedTab, setSelectedTab] = useState<RunDataTab>();
  const tab = selectedTab ?? (hasOutput ? 'output' : 'input');

  return (
    <Collapsible className="border-t border-border/50" data-testid="workflow-run-data">
      <CollapsibleTrigger className="flex min-h-11 w-full items-center gap-2 px-5 py-3 text-caption text-muted-foreground">
        <Database aria-hidden className="size-3.5 text-muted-foreground" />
        <span>Run data</span>
        <ChevronRight aria-hidden className="ml-auto size-4 text-muted-foreground" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Tabs defaultTab={tab} value={tab} onValueChange={setSelectedTab} className="min-w-0 px-5 pb-4">
          <TabList variant="pill" className="mb-3">
            <Tab value="input">
              <ArrowDownToLine aria-hidden className="size-3.5" />
              Input
            </Tab>
            {hasOutput && (
              <Tab value="output">
                <ArrowUpFromLine aria-hidden className="size-3.5" />
                Output
              </Tab>
            )}
            <Tab value="execution">
              <Braces aria-hidden className="size-3.5" />
              Execution
            </Tab>
          </TabList>
          <TabContent value="input" flush>
            <RunDataValue value={result.input !== undefined ? result.input : input} />
          </TabContent>
          {hasOutput && (
            <TabContent value="output" flush>
              <RunDataValue value={output} />
            </TabContent>
          )}
          <TabContent value="execution" flush>
            <RunDataValue value={result} />
          </TabContent>
        </Tabs>
      </CollapsibleContent>
    </Collapsible>
  );
}
