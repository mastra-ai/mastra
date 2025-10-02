"use client";
import { useEffect, useId } from "react";
import sdk from "@stackblitz/sdk";
import packageJson from "./files/package.json";
import packageLock from "./files/package-lock.json";
import tsconfig from "./files/tsconfig.json";
import { makeMastraFile } from "./files/makeMastraFile";

export const Codeblock = ({ code }: { code: string }) => {
  const id = useId();
  useEffect(() => {
    const setup = async () => {
      const vm = await sdk.embedProject(
        id,
        {
          title: "This is cool",
          description: "A basic Node.js project",
          template: "node",
          files: {
            "tsconfig.json": JSON.stringify(tsconfig, null, 2),
            "package.json": JSON.stringify(packageJson, null, 2),
            "package-lock.json": JSON.stringify(packageLock, null, 2),
            "src/mastra/index.ts": makeMastraFile(code),
          },
        },
        {
          openFile: "src/mastra/index.ts",
          showSidebar: false,
          terminalHeight: 0,
          width: "868",
          height: `500px`,
          hideDevTools: true,
          hideExplorer: true,
          hideNavigation: true,
        },
      );

      let url;

      while (!url) {
        try {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          url = await vm.preview.getUrl();
        } catch {
          continue;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
      vm.preview.setUrl("/workflows/workflow/graph");
    };

    setup();
  }, [code, id]);

  return (
    <div
      id={id}
      style={{ borderRadius: "8px", overflow: "hidden", paddingTop: "16px" }}
    />
  );
};
