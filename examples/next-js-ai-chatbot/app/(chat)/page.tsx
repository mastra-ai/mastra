import { cookies } from 'next/headers';

import { Chat } from '@/components/chat';
import { generateUUID } from '@/lib/utils';
import { DataStreamHandler } from '@/components/data-stream-handler';

export default async function Page() {
  const id = generateUUID();

  return (
    <>
      <Chat key={id} id={id} initialMessages={[]} isReadonly={false} />
      <DataStreamHandler id={id} />
    </>
  );
}
