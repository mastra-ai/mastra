import { Tag } from "@/components/tag";

const meta = {
  "mastra-voice": "Mastra Voice",
  "composite-voice": "Composite Voice",
  "voice.speak": ".speak()",
  "voice.listen": ".listen()",
  "voice.getSpeakers": ".getSpeakers()",
  "voice.connect": (
    <Tag showAbbr text="realtime">
      .connect()
    </Tag>
  ),
  "voice.send": (
    <Tag showAbbr text="realtime">
      .send()
    </Tag>
  ),
  "voice.answer": (
    <Tag showAbbr text="realtime">
      .answer()
    </Tag>
  ),
  "voice.on": (
    <Tag showAbbr text="realtime">
      .on()
    </Tag>
  ),
  "voice.events": (
    <Tag showAbbr text="realtime">
      events
    </Tag>
  ),
  "voice.off": (
    <Tag showAbbr text="realtime">
      .off()
    </Tag>
  ),
  "voice.close": (
    <Tag showAbbr text="realtime">
      .close()
    </Tag>
  ),
  "voice.addInstructions": (
    <Tag showAbbr text="realtime">
      .addInstructions()
    </Tag>
  ),
  "voice.addTools": (
    <Tag showAbbr text="realtime">
      .addTools()
    </Tag>
  ),
  "voice.updateConfig": (
    <Tag showAbbr text="realtime">
      .updateConfig()
    </Tag>
  ),
  deepgram: "Deepgram",
  elevenlabs: "ElevenLabs",
  google: "Google",
  murf: "Murf",
  openai: "OpenAI",
  "openai-realtime": "OpenAI Realtime",
  playai: "PlayAI",
  sarvam: "Sarvam",
  speechify: "Speechify",
  azure: "Azure",
  cloudflare: "Cloudflare",
};

export default meta;
