import { Skeleton, Txt } from '@mastra/playground-ui';
import type { MastraUIMessage } from '@mastra/react';
import { useState } from 'react';
import Markdown from 'react-markdown';
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
              <ReasoningMessage key={key} text="Reasoning..." streaming />
            ) : (
              <ReasoningMessage key={key} text="Finished reasoning" />
            );

          case 'dynamic-tool': {
            return <ToolExecutionMessage key={key} />;
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
          className="whitespace-pre-wrap text-neutral6 rounded-2xl bg-surface3 px-4 py-2.5 max-w-[80%]"
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

export const ReasoningMessage = ({ text, streaming = false }: { text: string; streaming?: boolean }) => {
  return (
    <Txt variant="ui-md" className="whitespace-pre-wrap leading-relaxed text-neutral4 max-w-[80%]">
      {streaming ? <Shimmer>{text}</Shimmer> : text}
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
        <Skeleton className="h-8 w-56 rounded-md" />
      </div>
      <Skeleton className="h-5 w-[70%] rounded-md" />
      <Skeleton className="h-5 w-[55%] rounded-md" />
      <div className="flex justify-end">
        <Skeleton className="h-8 w-40 rounded-md" />
      </div>
      <Skeleton className="h-5 w-[65%] rounded-md" />
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
