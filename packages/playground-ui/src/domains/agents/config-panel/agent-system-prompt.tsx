import { FileText, WrapText } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { AgentMetadataSection } from './agent-metadata-section';
import { normalizePromptIndentation } from './normalize-prompt-indentation';
import { Button } from '@/ds/components/Button';
import { Code } from '@/ds/components/Code';
import { CopyButton } from '@/ds/components/CopyButton';
import { MarkdownRenderer } from '@/ds/components/MarkdownRenderer';
import { Tab, TabContent, TabList, Tabs } from '@/ds/components/Tabs';
import { Txt } from '@/ds/components/Txt';
import { focusRing } from '@/ds/primitives/transitions';
import { cn } from '@/utils/cn';

const promptTabClassName =
  'h-control-sm px-1 underline-offset-4 data-[active]:underline pointer-coarse:min-h-11 pointer-coarse:min-w-11';

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
          <div className="group/prompt relative min-w-0 pointer-coarse:pt-12">
            <div className="absolute top-0 right-0 z-10 flex items-center gap-1 rounded-md bg-background opacity-0 group-focus-within/prompt:opacity-100 group-hover/prompt:opacity-100 pointer-coarse:opacity-100">
              {activeTab === 'source' && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Wrap lines"
                  aria-pressed={wrapSource}
                  tooltip="Wrap lines"
                  className="aria-pressed:bg-fill-hover aria-pressed:text-foreground pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                  onClick={() => setWrapSource(wrapped => !wrapped)}
                >
                  <WrapText />
                </Button>
              )}
              <CopyButton
                content={instructions}
                tooltip="Copy system prompt"
                variant="ghost"
                size="icon-sm"
                className="pointer-coarse:min-h-11 pointer-coarse:min-w-11"
              />
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
                  'min-w-0 overflow-x-auto text-foreground',
                  focusRing,
                  wrapSource ? '[overflow-wrap:anywhere] whitespace-pre-wrap' : 'whitespace-pre',
                  'text-caption',
                )}
              />
            </TabContent>
          </div>
        ) : (
          <Txt variant="caption" tone="muted">
            No system prompt configured
          </Txt>
        )}
        {children}
      </AgentMetadataSection>
    </Tabs>
  );
}
