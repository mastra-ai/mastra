import { Tabs as CodeTabs } from "nextra/components";

/**
 * @param children content of the tabs e.g <Tab>npm i mastra</Tab>
 * @param items items to display in the tabs, default is npm, pnpm, yarn, bun
 * @returns a tabs component
 */
export const Tabs = ({
  children,
  items = ["npm", "pnpm", "yarn", "bun"],
}: {
  children: React.ReactNode;
  items: string[];
}) => {
  return <CodeTabs items={items}>{children}</CodeTabs>;
};

/**
 * @param children content of the tab
 * @returns a tab component
 */
export const Tab = ({ children }: { children: React.ReactNode }) => {
  return <CodeTabs.Tab>{children}</CodeTabs.Tab>;
};
