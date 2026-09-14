import { Card, CardContent } from '@mastra/playground-ui/components/Card';
import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import { Tab, TabContent, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import { Txt } from '@mastra/playground-ui/components/Txt';

export function AgentSystemPrompt({ instructions }: { instructions: string }) {
  if (!instructions.trim()) {
    return <Txt variant="caption">No system prompt configured</Txt>;
  }

  return (
    <Card className="min-w-0">
      <CardContent>
        <Tabs defaultTab="read">
          <div className="flex items-center justify-between gap-2">
            <TabList variant="pill-ghost">
              <Tab value="read">Read</Tab>
              <Tab value="source">Source</Tab>
            </TabList>
            <CopyButton content={instructions} tooltip="Copy system prompt" variant="ghost" size="icon-sm" />
          </div>
          <TabContent value="read">
            <MarkdownRenderer>{instructions}</MarkdownRenderer>
          </TabContent>
          <TabContent value="source">
            <CodeEditor
              value={instructions}
              language="markdown"
              editable={false}
              showCopyButton={false}
              variant="embedded"
            />
          </TabContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
