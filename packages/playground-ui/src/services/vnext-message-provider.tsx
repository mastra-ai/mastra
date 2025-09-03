import React from 'react';
import { TextMessagePart, ThreadMessageLike } from '@assistant-ui/react';
import { createContext, ReactNode, useContext, useState } from 'react';

const MessagesContext = createContext<{
  messages: ThreadMessageLike[];
  setMessages: React.Dispatch<React.SetStateAction<ThreadMessageLike[]>>;
  appendToLastMessage: (partial: string) => void;
}>({
  messages: [],
  setMessages: () => {},
  appendToLastMessage: () => {},
});

export const MessagesProvider = ({ children }: { children: ReactNode }) => {
  const [messages, setMessages] = useState<ThreadMessageLike[]>([]);

  const appendToLastMessage = (partial: string) =>
    setMessages(msgs => {
      const lastMsg = msgs[msgs.length - 1];

      const content =
        typeof lastMsg.content === 'string' ? lastMsg.content : (lastMsg.content?.[0] as TextMessagePart).text;

      return [
        ...msgs.slice(0, -1),
        {
          ...lastMsg,
          content: [{ type: 'text', text: content + partial }],
        },
      ];
    });

  return (
    <MessagesContext.Provider value={{ messages, setMessages, appendToLastMessage }}>
      {children}
    </MessagesContext.Provider>
  );
};

export const useMessages = () => useContext(MessagesContext);
