import { useEffect, useState } from 'react';

import { Chat } from './components/Chat';
import { ThemeProvider } from './components/ui/theme-provider';

function App() {
  const [agentId, setAgentId] = useState<string>('');

  useEffect(() => {
    // Extract agentId from URL path /agent/:agentId
    const pathParts = window.location.pathname.split('/');
    const id = pathParts[2];
    if (id) {
      setAgentId(id);
    }
  }, []);

  return (
    <ThemeProvider defaultTheme="dark" attribute="class">
      <div className="flex flex-col min-h-screen bg-background">
        <header className="sticky top-0 z-50 flex items-center justify-between w-full h-12 px-4 border-b bg-background">
          <div className="flex items-center gap-2">
            <div className="bg-muted flex size-[25px] shrink-0 select-none items-center justify-center rounded-md border shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36" fill="none">
                <circle cx="18.0002" cy="18.0002" r="15.2365" stroke="currentColor" strokeWidth="1.25409" />
                <ellipse
                  cx="18.0008"
                  cy="18"
                  rx="15.2365"
                  ry="10.2193"
                  transform="rotate(45 18.0008 18)"
                  stroke="currentColor"
                  strokeWidth="1.25409"
                />
                <path d="M11.7793 18.0547H24.3007" stroke="currentColor" strokeWidth="1.25409" />
                <path d="M14.8574 21.2354L21.2192 14.8736" stroke="currentColor" strokeWidth="1.25409" />
                <path d="M21.2207 21.2354L14.8589 14.8736" stroke="currentColor" strokeWidth="1.25409" />
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M7.57571 11.2943C4.93105 13.0681 3.39081 15.4508 3.39081 17.9997C3.39081 20.5486 4.93105 22.9313 7.57571 24.7051C10.2163 26.4762 13.9001 27.592 18.0003 27.592C22.1004 27.592 25.7842 26.4762 28.4248 24.7051C31.0695 22.9313 32.6097 20.5486 32.6097 17.9997C32.6097 15.4508 31.0695 13.0681 28.4248 11.2943C25.7842 9.5232 22.1004 8.40741 18.0003 8.40741C13.9001 8.40741 10.2163 9.5232 7.57571 11.2943ZM6.87715 10.2528C9.75106 8.32521 13.6855 7.15332 18.0003 7.15332C22.315 7.15332 26.2495 8.32521 29.1234 10.2528C31.9932 12.1776 33.8638 14.9046 33.8638 17.9997C33.8638 21.0948 31.9932 23.8218 29.1234 25.7466C26.2495 27.6742 22.315 28.8461 18.0003 28.8461C13.6855 28.8461 9.75106 27.6742 6.87715 25.7466C4.00728 23.8218 2.13672 21.0948 2.13672 17.9997C2.13672 14.9046 4.00728 12.1776 6.87715 10.2528Z"
                  fill="currentColor"
                />
              </svg>
            </div>
            <h1 className="font-medium text-sm font-mono">Chat with {agentId}</h1>
          </div>
        </header>
        <main className="flex-1 relative">
          <Chat agentId={agentId} />
        </main>
      </div>
    </ThemeProvider>
  );
}

export default App;
