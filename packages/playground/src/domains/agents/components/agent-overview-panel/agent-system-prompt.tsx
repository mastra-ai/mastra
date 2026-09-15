import { Button } from '@mastra/playground-ui/components/Button';
import { Code } from '@mastra/playground-ui/components/Code';
import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import { Tab, TabContent, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { WrapText } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export function AgentSystemPrompt({ instructions }: { instructions: string }) {
  const [activeTab, setActiveTab] = useState('read');
  const [wrapSource, setWrapSource] = useState(true);

  if (!instructions.trim()) {
    return <Txt variant="caption">No system prompt configured</Txt>;
  }

  return (
    <Tabs defaultTab="read" value={activeTab} onValueChange={setActiveTab} className="min-w-0 overflow-visible">
      <div className="flex items-center justify-between gap-2">
        <TabList variant="pill-ghost">
          <Tab value="read">Read</Tab>
          <Tab value="source">Source</Tab>
        </TabList>
        <div className="flex items-center gap-1">
          {activeTab === 'source' && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Wrap lines"
              aria-pressed={wrapSource}
              tooltip="Wrap lines"
              className="aria-pressed:bg-surface3 aria-pressed:text-neutral5"
              onClick={() => setWrapSource(wrapped => !wrapped)}
            >
              <WrapText />
            </Button>
          )}
          <CopyButton content={instructions} tooltip="Copy system prompt" variant="ghost" size="icon-sm" />
        </div>
      </div>
      <TabContent value="read" className="overflow-visible">
        <MarkdownRenderer codeBlockVariant="embedded">{instructions}</MarkdownRenderer>
      </TabContent>
      <TabContent value="source" className="overflow-visible">
        <Code
          code={instructions}
          lang="markdown"
          role="region"
          aria-label="System prompt source"
          tabIndex={0}
          className={cn(
            'text-ui-sm text-neutral5 min-w-0 overflow-x-auto py-2 font-mono leading-relaxed focus-visible:outline-neutral3 focus-visible:outline-1 focus-visible:outline-offset-2',
            wrapSource ? 'whitespace-pre-wrap [overflow-wrap:anywhere]' : 'whitespace-pre',
          )}
        />
      </TabContent>
    </Tabs>
  );
}
