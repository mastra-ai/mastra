import { Skeleton, Txt } from '@mastra/playground-ui';
import type { MastraUIMessage } from '@mastra/react';
import { Check, Loader2 } from 'lucide-react';
import { useState } from 'react';
import Markdown from 'react-markdown';
import { AGENT_BUILDER_TOOL_NAME } from '../agent-builder-edit/hooks/use-agent-builder-tool';
import { Shimmer } from './shimmer';

export const MessageRow = ({ message }: { message: MastraUIMessage }) => {
  return (
    <>
      {message.parts.map((part, index) => {
        const key = `${message.id}-${index}`;
        switch (part.type) {
          case 'text':
            return <Txtmessage key={key} txt={part.text} role={message.role} />;

          case 'reasoning':
            return part.state === 'streaming' ? (
              <ReasoningMessage key={key} text="Anayzing the agent requirements..." streaming />
            ) : (
              <ReasoningMessage key={key} text="Requirements analyzed, preparing the agent." />
            );

          case 'dynamic-tool': {
            if (part.toolName === AGENT_BUILDER_TOOL_NAME) {
              const toolsAdded = (part.input as { tools: { id: string; name: string }[] })?.tools ?? [];
              return <BuilderAgentToolMessage toolsAdded={toolsAdded} key={key} />;
            }

            return <ToolExecutionMessage key={key} />;
          }

          // TMP removed to see how it behaves
          // case `tool-${AGENT_BUILDER_TOOL_NAME}`: {
          //   const toolsAdded = part.input.tools ?? [];
          //   return <BuilderAgentToolMessage toolsAdded={toolsAdded} key={key} />;
          // }

          default: {
            return null;
          }
        }
      })}
    </>
  );
};

export const Txtmessage = ({ txt, role }: { txt: string; role: MastraUIMessage['role'] }) => {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <Txt
          variant="ui-md"
          className="whitespace-pre-wrap bg-white text-black rounded-2xl px-4 py-2.5 max-w-[80%]"
          as="div"
        >
          <Markdown>{txt}</Markdown>
        </Txt>
      </div>
    );
  }

  if (role === 'assistant' || role === 'system') {
    return (
      <Txt variant="ui-md" className="whitespace-pre-wrap leading-relaxed text-neutral4 max-w-[80%]" as="div">
        <Markdown>{txt}</Markdown>
      </Txt>
    );
  }

  return null;
};

export const PendingIndicator = () => {
  return (
    <Txt
      variant="ui-md"
      className="whitespace-pre-wrap leading-relaxed text-neutral4 max-w-[80%] flex items-center gap-2"
      as="div"
      data-testid="agent-builder-chat-pending"
    >
      <Loader2 className="animate-spin size-4 text-neutral3" />
      <Shimmer>Thinking…</Shimmer>
    </Txt>
  );
};

export const ReasoningMessage = ({ text, streaming = false }: { text: string; streaming?: boolean }) => {
  return (
    <Txt
      variant="ui-md"
      className="whitespace-pre-wrap leading-relaxed text-neutral4 max-w-[80%] flex items-center gap-2"
      as="div"
    >
      {streaming ? (
        <>
          <Loader2 className="animate-spin size-4 text-neutral3" />

          <Shimmer>{text}</Shimmer>
        </>
      ) : (
        <>
          <Check className="text-neutral3 size-4" />

          {text}
        </>
      )}
    </Txt>
  );
};

const words = [
  'loading',
  'cooking',
  'processing',
  'preparing',
  'building',
  'rendering',
  'fetching',
  'compiling',
  'generating',
  'brewing',
  'mixing',
  'heating',
  'baking',
  'roasting',
  'simmering',
  'boiling',
  'frying',
  'grilling',
  'steaming',
  'toasting',
  'melting',
  'blending',
  'stirring',
  'whisking',
  'kneading',
  'assembling',
  'crafting',
  'forging',
  'shaping',
  'forming',
  'spinning',
  'warming',
  'igniting',
  'starting',
  'booting',
  'charging',
  'spooling',
  'buffering',
  'calculating',
  'computing',
  'decoding',
  'encoding',
  'hydrating',
  'marinating',
  'infusing',
  'curing',
  'plating',
  'serving',
  'finishing',
  'settling',
];

export const MessagesSkeleton = ({ testId }: { testId?: string }) => {
  return (
    <div className="flex flex-col gap-6" data-testid={testId}>
      <div className="flex justify-end">
        <Skeleton className="h-10 w-56 rounded-2xl" />
      </div>
      <Skeleton className="h-6 w-[70%] rounded-full" />
      <Skeleton className="h-6 w-[55%] rounded-full" />
      <div className="flex justify-end">
        <Skeleton className="h-10 w-40 rounded-2xl" />
      </div>
      <Skeleton className="h-6 w-[65%] rounded-full" />
    </div>
  );
};

export const ToolExecutionMessage = () => {
  const [randomWord] = useState(() => words[Math.floor(Math.random() * words.length)]);
  return (
    <Txt variant="ui-md" className="whitespace-pre-wrap leading-relaxed text-neutral4 max-w-[80%]">
      {randomWord.charAt(0).toUpperCase() + randomWord.slice(1)}...
    </Txt>
  );
};

const BuilderAgentToolMessage = ({ toolsAdded, key }: { toolsAdded: { id: string; name: string }[]; key: string }) => {
  if (toolsAdded.length === 0) {
    return null;
  }

  return (
    <div className="border border-1 p-3 rounded-xl">
      <Txt variant="ui-sm" className="whitespace-pre-wrap leading-relaxed text-neutral3 pb-2" as="div">
        Agent capabilities unlocked:
      </Txt>

      <ul key={key} className="space-y-1">
        {toolsAdded.map((tool: { id: string; name: string }) => (
          <li key={`${key}-${tool.id}`} className="flex items-center gap-2">
            <Check className="w-4 h-4 text-neutral3" /> <Txtmessage key={key} txt={tool.name} role="assistant" />
          </li>
        ))}
      </ul>
    </div>
  );
};
