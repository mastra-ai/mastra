/**
 * Custom Prism theme for Mastra - Dark Mode
 * Based on theme.json from Starlight docs
 */

const theme = {
  plain: {
    color: "#fff",
    backgroundColor: "#171717",
  },
  styles: [
    {
      types: ["comment", "prolog", "doctype", "cdata"],
      style: {
        color: "#939393",
        fontStyle: "italic",
      },
    },
    {
      types: ["namespace"],
      style: {
        opacity: 0.7,
      },
    },
    {
      types: ["string", "attr-value"],
      style: {
        color: "#46f488",
      },
    },
    {
      types: ["punctuation", "operator"],
      style: {
        color: "#fff",
      },
    },
    {
      types: [
        "entity",
        "url",
        "symbol",
        "number",
        "boolean",
        "variable",
        "constant",
        "property",
        "regex",
        "inserted",
      ],
      style: {
        color: "#fff",
      },
    },
    {
      types: ["atrule", "keyword", "attr-name", "selector"],
      style: {
        color: "#fa7b6a",
      },
    },
    {
      types: ["function", "deleted", "tag"],
      style: {
        color: "#d06bee",
      },
    },
    {
      types: ["function-variable"],
      style: {
        color: "#d06bee",
      },
    },
    {
      types: ["tag", "selector", "keyword"],
      style: {
        color: "#fa7b6a",
      },
    },
  ],
};

export default theme;
