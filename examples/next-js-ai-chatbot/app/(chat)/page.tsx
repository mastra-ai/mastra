import { generateUUID } from '@/lib/utils';

import { Chat } from '@/components/chat';

export default async function Page() {
  const id = generateUUID();

  return <Chat key={id} id={id} initialMessages={[]} isReadonly={false} />;
}
