import { safeStringify } from '@mastra/core/utils/safe-stringify';
import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { Tabs, TabList, Tab, TabContent } from '@mastra/playground-ui/components/Tabs';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ArrowDownToLine, ArrowUpFromLine, Braces, ChevronRight, Database } from 'lucide-react';
import type { WorkflowRunStreamResult } from '../context/workflow-run-context';

function RunDataValue({ value }: { value: unknown }) {
  if (value === undefined) {
    return (
      <Txt className="block p-4 text-neutral3" variant="ui-sm">
        No input recorded
      </Txt>
    );
  }
  return (
    <CodeEditor
      value={safeStringify(value, 2)}
      editable={false}
      lineNumbers={false}
      className="max-h-72 overflow-auto rounded-lg border border-border1 bg-surface2 p-3"
    />
  );
}

export function WorkflowRunData({ input, result }: { input: unknown; result: WorkflowRunStreamResult }) {
  const output = 'result' in result ? result.result : undefined;
  const hasOutput = output !== undefined;

  return (
    <Collapsible className="border-t border-border1/50" data-testid="workflow-run-data">
      <CollapsibleTrigger className="flex min-h-11 w-full items-center gap-2 px-5 py-3 text-ui-sm text-neutral4">
        <Database aria-hidden className="size-3.5 text-neutral3" />
        <span>Run data</span>
        <ChevronRight aria-hidden className="ml-auto size-4 text-neutral3" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Tabs defaultTab={hasOutput ? 'output' : 'input'} className="min-w-0 px-5 pb-4">
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
            <RunDataValue value={input} />
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
