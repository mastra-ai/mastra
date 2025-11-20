/**
 * Custom Prism theme for Mastra - Light Mode
 * Based on theme.json from Starlight docs
 */

const theme = {
  plain: {
    color: "#0a0a0a",
    backgroundColor: "#f2f2f2",
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
        color: "#158D29",
      },
    },
    {
      types: ["punctuation", "operator"],
      style: {
        color: "#5f5f5f",
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
        color: "#0a0a0a",
      },
    },
    {
      types: ["atrule", "keyword", "attr-name", "selector"],
      style: {
        color: "#D81717",
      },
    },
    {
      types: ["function", "deleted", "tag"],
      style: {
        color: "#9829C7",
      },
    },
    {
      types: ["function-variable"],
      style: {
        color: "#9829C7",
      },
    },
    {
      types: ["tag", "selector", "keyword"],
      style: {
        color: "#D81717",
      },
    },
  ],
};

export default theme;
