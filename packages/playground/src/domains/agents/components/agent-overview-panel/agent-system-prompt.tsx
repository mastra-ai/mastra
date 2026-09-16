import { Button } from '@mastra/playground-ui/components/Button';
import { Code } from '@mastra/playground-ui/components/Code';
import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import { Tab, TabContent, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { FileText, WrapText } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { AgentMetadataSection } from '../agent-metadata/agent-metadata-section';
import { normalizePromptIndentation } from './normalize-prompt-indentation';
import { cn } from '@/lib/utils';

const promptTabClassName = 'h-form-sm px-1 text-ui-sm font-medium underline-offset-4 data-[active]:underline';

export function AgentSystemPrompt({ instructions, children }: { instructions: string; children?: ReactNode }) {
  const [activeTab, setActiveTab] = useState('read');
  const [wrapSource, setWrapSource] = useState(true);

  const hasInstructions = Boolean(instructions.trim());

  return (
    <Tabs defaultTab="read" value={activeTab} onValueChange={setActiveTab} className="min-w-0 overflow-visible">
      <AgentMetadataSection
        title="System Prompt"
        accent="pink"
        icon={<FileText />}
        actions={
          hasInstructions && (
            <div className="shrink-0">
              <TabList variant="pill-ghost" className="[--tab-indicator-color:transparent]">
                <Tab value="read" className={promptTabClassName}>
                  Read
                </Tab>
                <Tab value="source" className={promptTabClassName}>
                  Source
                </Tab>
              </TabList>
            </div>
          )
        }
      >
        {hasInstructions ? (
          <div className="group/prompt relative min-w-0 pointer-coarse:pt-8">
            <div className="bg-surface2 absolute top-0 right-0 z-10 flex items-center gap-1 rounded-md opacity-0 group-focus-within/prompt:opacity-100 group-hover/prompt:opacity-100 pointer-coarse:opacity-100">
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
            <TabContent value="read" className="overflow-visible py-0">
              <MarkdownRenderer>{normalizePromptIndentation(instructions)}</MarkdownRenderer>
            </TabContent>
            <TabContent value="source" className="overflow-visible py-0">
              <Code
                code={instructions}
                lang="markdown"
                role="region"
                aria-label="System prompt source"
                tabIndex={0}
                className={cn(
                  'text-ui-sm text-neutral5 min-w-0 overflow-x-auto font-mono leading-relaxed focus-visible:outline-neutral3 focus-visible:outline-1 focus-visible:outline-offset-2',
                  wrapSource ? 'whitespace-pre-wrap [overflow-wrap:anywhere]' : 'whitespace-pre',
                )}
              />
            </TabContent>
          </div>
        ) : (
          <Txt variant="caption">No system prompt configured</Txt>
        )}
        {children}
      </AgentMetadataSection>
    </Tabs>
  );
}
