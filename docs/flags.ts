import { flag } from "flags/next";

export const kapaChatbotFlag = flag({
  key: "kapa-chatbot-flag",
  decide() {
    return process.env.KAPA_CHATBOT_FLAG === "true";
  },
});
