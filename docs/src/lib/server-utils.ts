import { flag } from "@vercel/flags/next";

export const isCopilotKitEnabled = flag({
  key: "copilot-kit",
  description: "show copilot kit",
  defaultValue: false,
  decide: async () => {
    const isEnabled = process.env.NEXT_PUBLIC_COPILOT_KIT_ENABLED === "true";
    return isEnabled;
  },
});

export const precomputeFlags = [isCopilotKitEnabled] as const;
