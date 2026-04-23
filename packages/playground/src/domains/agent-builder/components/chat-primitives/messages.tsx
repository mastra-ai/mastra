import { Txt } from '@mastra/playground-ui';
import type { MastraUIMessage } from '@mastra/react';
import Markdown from 'react-markdown';

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
              <ReasoningMessage key={key} text="Reasoning..." />
            ) : (
              <ReasoningMessage key={key} text="Finished reasoning" />
            );

          case 'dynamic-tool': {
            return <ToolExecutionMessage key={key} toolName={part.toolName} />;
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
          variant="ui-sm"
          className="whitespace-pre-wrap text-neutral6 rounded-md bg-surface3 px-2 py-1 max-w-[80%]"
          as="div"
        >
          <Markdown>{txt}</Markdown>
        </Txt>
      </div>
    );
  }

  if (role === 'assistant' || role === 'system') {
    return (
      <Txt variant="ui-sm" className="whitespace-pre-wrap leading-relaxed text-neutral4 max-w-[80%]" as="div">
        <Markdown>{txt}</Markdown>
      </Txt>
    );
  }

  return null;
};

export const ReasoningMessage = ({ text }: { text: string }) => {
  return (
    <Txt variant="ui-sm" className="whitespace-pre-wrap leading-relaxed text-neutral4 max-w-[80%]">
      {text}
    </Txt>
  );
};

export const ToolExecutionMessage = ({ toolName }: { toolName: string }) => {
  return (
    <Txt variant="ui-sm" className="whitespace-pre-wrap leading-relaxed text-neutral4 max-w-[80%]">
      {toolName} executing...
    </Txt>
  );
};
