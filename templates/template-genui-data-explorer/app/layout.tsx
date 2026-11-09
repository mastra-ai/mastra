import type { ReactNode } from "react";
import "@copilotkit/react-ui/v2/styles.css";
import "./style.css";
export const metadata = {
  title: "Mastra GenUI Data Explorer",
  description: "Verified example SaaS analytics in a persistent generative workspace.",
};
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
