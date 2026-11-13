import { ToolCallBody, toolCallHasBody } from '@mastra/playground-ui/components/ai/tool-call';
import type { ToolCallView } from '@mastra/playground-ui/components/ai/tool-call';

import { KNOWLEDGE_TOOLS, knowledgeCard } from '@mastra/playground-ui/domains/chat/knowledge';

import { useEffect, useRef, useState } from 'react';

import { toolCallStatus } from '../../services/transcript';
import type { ToolCall } from '../../services/transcript';

/** The PNG a finished `browser_screenshot` returned, as an image URL. */
function screenshotSrc(tool: ToolCall): string | undefined {
  if (tool.toolName !== 'browser_screenshot' || tool.status !== 'done') return undefined;
  const result = tool.result;
  if (result === null || typeof result !== 'object' || !('base64' in result)) return undefined;
  return typeof result.base64 === 'string' && result.base64 ? `data:image/png;base64,${result.base64}` : undefined;
}

/** A finished Knowledge tool call drawn as its card body (pages linked to the viewer), or undefined. */
export function toolKnowledgeCard(tool: ToolCall) {
  if (tool.status !== 'done' || !KNOWLEDGE_TOOLS.has(tool.toolName)) return undefined;
  return knowledgeCard(tool.toolName, tool.args, tool.result) ?? undefined;
}

function toolCallView(tool: ToolCall, command: string | undefined): ToolCallView {
  return {
    toolName: tool.toolName,
    args: tool.args,
    argsText: tool.argsText,
    status: toolCallStatus(tool.status),
    command,
    output: tool.output,
    result: tool.result,
    exit: tool.exit,
  };
}

export function toolHasBody(tool: ToolCall, command: string | undefined): boolean {
  return Boolean(toolKnowledgeCard(tool)) || toolCallHasBody(toolCallView(tool, command));
}

/**
 * Full-page captures are tall, so the image starts capped. Only an image the cap actually
 * cuts down opens to full size on click; a small one is just an image.
 */
function Screenshot({ src }: { src: string }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [shrunk, setShrunk] = useState(false);
  const [fullSize, setFullSize] = useState(false);

  // The image is shrunk to fit the transcript (its width, and 480px high at most). It keeps its aspect
  // ratio, so a wide or a tall screenshot that lost detail both show up as a shorter height. Measure
  // again when the transcript resizes.
  const measure = () => {
    const img = imageRef.current;
    if (img && !fullSize) setShrunk(img.naturalHeight > img.offsetHeight);
  };
  useEffect(() => {
    const img = imageRef.current;
    if (!img || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(img);
    return () => observer.disconnect();
  });

  return (
    <div className="overflow-x-auto">
      <button
        type="button"
        disabled={!shrunk}
        aria-label={shrunk ? (fullSize ? 'Show smaller' : 'Show full size') : undefined}
        aria-pressed={shrunk ? fullSize : undefined}
        onClick={() => setFullSize(value => !value)}
        className={shrunk ? (fullSize ? 'cursor-zoom-out' : 'cursor-zoom-in') : 'cursor-default'}
      >
        <img
          ref={imageRef}
          src={src}
          alt="Screenshot of the agent's browser"
          onLoad={measure}
          className={`border-border rounded-md border ${fullSize ? 'max-w-none' : 'max-h-[480px] max-w-full'}`}
        />
      </button>
    </div>
  );
}

export function ToolBody({ tool, command }: { tool: ToolCall; command?: string }) {
  const screenshot = screenshotSrc(tool);
  if (screenshot) return <Screenshot src={screenshot} />;

  const knowledge = toolKnowledgeCard(tool);
  if (knowledge) return <>{knowledge.body}</>;

  return <ToolCallBody {...toolCallView(tool, command)} />;
}
