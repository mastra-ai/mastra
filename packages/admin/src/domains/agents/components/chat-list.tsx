import { Separator } from '@/components/ui/seperator';

export type Message = {
  id: string;
  text: string;
};
export interface ChatListProps {
  messages: Array<Message>;
}
export function ChatList({ messages }: ChatListProps) {
  if (!messages.length) {
    return null;
  }

  return (
    <div className="relative mx-auto max-w-2xl px-4">
      {messages.map((message, index) => (
        <div key={message.id}>
          <div className="flex w-full gap-2 items-center">
            <div className="bg-mastra-bg-2 flex size-[25px] shrink-0 select-none items-center justify-center rounded-md border shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" className="size-4">
                <path d="M230.92 212c-15.23-26.33-38.7-45.21-66.09-54.16a72 72 0 1 0-73.66 0c-27.39 8.94-50.86 27.82-66.09 54.16a8 8 0 1 0 13.85 8c18.84-32.56 52.14-52 89.07-52s70.23 19.44 89.07 52a8 8 0 1 0 13.85-8ZM72 96a56 56 0 1 1 56 56 56.06 56.06 0 0 1-56-56Z"></path>
              </svg>
            </div>
            <span> {message.text}</span>
          </div>

          {index < messages.length - 1 && <Separator className="my-4" />}
        </div>
      ))}
    </div>
  );
}
