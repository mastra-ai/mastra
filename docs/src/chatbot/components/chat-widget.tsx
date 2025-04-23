"use client";
import { CopilotKit } from "@copilotkit/react-core";
import { CopilotPopup } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";
import React from "react";
import "@copilotkit/react-ui/styles.css";
import Spinner from "@/components/ui/spinner";

const DocsChat: React.FC = () => {
  return (
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      showDevConsole={false}
      // agent lock to the relevant agent
      agent="docsAgent"
    >
      <Chat />
    </CopilotKit>
  );
};

const Chat = () => {
  return (
    <div className="flex items-center justify-center w-full h-full">
      <div className="rounded-lg w-8/10 h-8/10">
        <CopilotPopup
          icons={{
            spinnerIcon: <Spinner />,
          }}
          labels={{
            title: "Mastra Assistant",
            initial: "Need any help?",
          }}
        />
      </div>
    </div>
  );
};

export default DocsChat;
