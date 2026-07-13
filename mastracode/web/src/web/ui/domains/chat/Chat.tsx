import { Outlet } from 'react-router';

import { OverlaysProvider } from '../../lib/overlays';
import { ActiveProjectProvider } from '../workspaces';
import { ChatSessionConfigProvider } from './context/ChatSessionProvider';

/** Shared persistent chat shell providers. Route leaves own thread state. */
export default function Chat() {
  return (
    <ActiveProjectProvider>
      <ChatSessionConfigProvider>
        <OverlaysProvider>
          <Outlet />
        </OverlaysProvider>
      </ChatSessionConfigProvider>
    </ActiveProjectProvider>
  );
}
