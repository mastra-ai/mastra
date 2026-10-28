import {
  ToolCallArguments,
  ToolCallCommand,
  ToolCallOutput,
  hasToolArguments,
  stringifyToolValue,
  stripSerializedAnsi,
  toolEdit,
} from '@mastra/playground-ui/components/ai/tool-call';

import { useEffect, useRef, useState } from 'react';

import type { ToolCall } from '../../services/transcript';

/** The PNG a finished `browser_screenshot` returned, as an image URL. */
function screenshotSrc(tool: ToolCall): string | undefined {
  if (tool.toolName !== 'browser_screenshot' || tool.status !== 'done') return undefined;
  const result = tool.result;
  if (result === null || typeof result !== 'object' || !('base64' in result)) return undefined;
  return typeof result.base64 === 'string' && result.base64 ? `data:image/png;base64,${result.base64}` : undefined;
}

function toolResultText(tool: ToolCall): string | undefined {
  if (tool.status === 'running' || tool.result === undefined || tool.result === null) return undefined;
  return stripSerializedAnsi(stringifyToolValue(tool.result)) || undefined;
}

export function toolHasBody(tool: ToolCall, command: string | undefined): boolean {
  if (command !== undefined || tool.output) return true;
  return hasToolArguments(tool) || toolResultText(tool) !== undefined;
}

const SCREENSHOT_MAX_HEIGHT = 480;

/**
 * Full-page captures are tall, so the image starts capped. Only an image the cap actually
 * cuts down opens to full size on click; a small one is just an image.
 */
function Screenshot({ src }: { src: string }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [capped, setCapped] = useState(false);
  const [fullSize, setFullSize] = useState(false);

  // The cap depends on the transcript's width, so measure again when the image is resized.
  const measure = () => {
    const img = imageRef.current;
    if (img && !fullSize) setCapped(img.offsetHeight >= SCREENSHOT_MAX_HEIGHT && img.naturalHeight > img.offsetHeight);
  };
  useEffect(() => {
    const img = imageRef.current;
    if (!img || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(img);
    return () => observer.disconnect();
  });

  return (
    <button
      type="button"
      disabled={!capped}
      aria-label={capped ? (fullSize ? 'Show smaller' : 'Show full size') : undefined}
      aria-pressed={capped ? fullSize : undefined}
      onClick={() => setFullSize(value => !value)}
      className={capped ? (fullSize ? 'cursor-zoom-out' : 'cursor-zoom-in') : 'cursor-default'}
    >
      <img
        ref={imageRef}
        src={src}
        alt="Screenshot of the agent's browser"
        onLoad={measure}
        className={`border-border max-w-full rounded-md border ${fullSize ? '' : 'max-h-[480px]'}`}
      />
    </button>
  );
}

export function ToolBody({ tool, command }: { tool: ToolCall; command?: string }) {
  const edit = toolEdit(tool.toolName, tool.args);
  const resultText = toolResultText(tool);
  const screenshot = screenshotSrc(tool);

  if (screenshot) return <Screenshot src={screenshot} />;

  if (edit) {
    return (
      <>
        <ToolCallArguments toolName={tool.toolName} args={tool.args} />
        {tool.status === 'error' && resultText !== undefined && (
          <ToolCallOutput text={resultText} maxLength={800} error />
        )}
      </>
    );
  }

  if (command) {
    return (
      <>
        <ToolCallCommand command={command} />
        {tool.output ? (
          <ToolCallOutput text={tool.output} />
        ) : (
          resultText !== undefined && <ToolCallOutput text={resultText} maxLength={800} />
        )}
      </>
    );
  }

  return (
    <>
      <ToolCallArguments toolName={tool.toolName} args={tool.args} argsText={tool.argsText} />
      {tool.output && <ToolCallOutput text={tool.output} />}
      {resultText !== undefined && <ToolCallOutput text={resultText} maxLength={800} />}
    </>
  );
}
