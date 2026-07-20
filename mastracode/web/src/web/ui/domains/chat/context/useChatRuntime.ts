import { useContext } from 'react';

import { ChatRuntimeContext } from './ChatRuntimeContext';

export function useChatRuntime() {
  const runtime = useContext(ChatRuntimeContext);
  if (!runtime) throw new Error('useChatRuntime must be used within a ChatRuntimeProvider');
  return runtime;
}
