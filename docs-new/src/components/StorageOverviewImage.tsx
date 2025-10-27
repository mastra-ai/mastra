import React from "react";
import { useColorMode } from "@docusaurus/theme-common";

export const StorageOverviewImage = () => {
  const { colorMode } = useColorMode();

  return (
    <div className="mt-4">
      <img
        className="rounded-lg"
        src={
          colorMode === "dark"
            ? "/img/mastra-storage-overview-dark.png"
            : "/img/mastra-storage-overview-light.png"
        }
        alt="Diagram showing storage in Mastra"
        width={700}
        height={700}
      />
    </div>
  );
};
