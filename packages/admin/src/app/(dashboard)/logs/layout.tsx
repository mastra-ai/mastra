import { LogProvider } from "@/domains/logs/providers/log-provider";

function LogsLayout({ children }: { children: React.ReactNode }) {
  return <LogProvider>{children}</LogProvider>;
}

export default LogsLayout;
