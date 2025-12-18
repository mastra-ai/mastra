/**
 * Sidebar for Examples
 */

// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  examplesSidebar: [
    {
      type: "doc",
      id: "index",
      label: "Overview",
    },
    {
      type: "category",
      label: "Voice",
      collapsed: true,
      items: [
        { type: "doc", id: "voice/text-to-speech", label: "Text to Speech" },
        { type: "doc", id: "voice/speech-to-text", label: "Speech to Text" },
        { type: "doc", id: "voice/turn-taking", label: "Turn Taking" },
        {
          type: "doc",
          id: "voice/speech-to-speech",
          label: "Speech to Speech",
        },
      ],
    },
  ],
};

export default sidebars;
