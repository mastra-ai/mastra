// Custom Prism theme for Mastra docs
module.exports = {
  plain: {
    color: "#d4d4d4",
    backgroundColor: "#1e1e1e",
  },
  styles: [
    {
      types: ["comment", "prolog", "doctype", "cdata"],
      style: {
        color: "#6A9955",
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
        color: "#ce9178",
      },
    },
    {
      types: ["punctuation", "operator"],
      style: {
        color: "#d4d4d4",
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
        color: "#b5cea8",
      },
    },
    {
      types: ["atrule", "keyword", "attr-name", "selector"],
      style: {
        color: "#c586c0",
      },
    },
    {
      types: ["function", "deleted", "tag"],
      style: {
        color: "#4ec9b0",
      },
    },
    {
      types: ["function-variable"],
      style: {
        color: "#dcdcaa",
      },
    },
    {
      types: ["tag", "selector", "keyword"],
      style: {
        color: "#569cd6",
      },
    },
  ],
};
