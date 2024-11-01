import { framework } from '@/lib/framework-utils';

import { LogProvider } from '@/domains/logs/providers/log-provider';

const registeredLoggers = Array.from(framework?.logger.keys() ?? []);

function LogsLayout({ children }: { children: React.ReactNode }) {
  return <LogProvider registeredLoggers={registeredLoggers}>{children}</LogProvider>;
}

export default LogsLayout;
