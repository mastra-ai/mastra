/** @type {import('next').NextConfig} */
import nextra from "nextra";

const withNextra = nextra({
  search: {
    codeblocks: true,
  },
  mdxOptions: {
    rehypePrettyCodeOptions: {
      theme: {
        displayName: "Mastra",
        name: "mastra",
        semanticHighlighting: true,
        semanticTokenColors: {
          customLiteral: "#fff",
          newOperator: "#C586C0",
          numberLiteral: "#b5cea8",
          stringLiteral: "#fff",
        },
        tokenColors: [
          {
            scope: ["meta.import.ts", "meta.import", "variable"],
            settings: {
              foreground: "#fff",
            },
          },
          {
            scope: [
              "meta.embedded",
              "source.groovy.embedded",
              "string meta.image.inline.markdown",
              "variable.legacy.builtin.python",
            ],
            settings: {
              foreground: "#D4D4D4",
            },
          },
          {
            scope: "emphasis",
            settings: {
              fontStyle: "italic",
            },
          },
          {
            scope: "strong",
            settings: {
              fontStyle: "bold",
            },
          },
          {
            scope: "header",
            settings: {
              foreground: "#000080",
            },
          },
          {
            scope: ["comment", "punctuation.definition.comment"],
            settings: {
              foreground: "#939393",
            },
          },
          {
            scope: "constant.language",
            settings: {
              foreground: "#D06BEE",
            },
          },
          {
            scope: [
              "constant.numeric",
              "variable.other.enummember",
              "keyword.operator.plus.exponent",
              "keyword.operator.minus.exponent",
            ],
            settings: {
              foreground: "#b5cea8",
            },
          },
          {
            scope: "constant.regexp",
            settings: {
              foreground: "#646695",
            },
          },
          {
            scope: "entity.name.tag",
            settings: {
              foreground: "#569cd6",
            },
          },
          {
            scope: ["entity.name.tag.css", "entity.name.tag.less"],
            settings: {
              foreground: "#d7ba7d",
            },
          },
          {
            scope: "entity.other.attribute-name",
            settings: {
              foreground: "#9cdcfe",
            },
          },
          {
            scope: [
              "entity.other.attribute-name.class.css",
              "source.css entity.other.attribute-name.class",
              "entity.other.attribute-name.id.css",
              "entity.other.attribute-name.parent-selector.css",
              "entity.other.attribute-name.parent.less",
              "source.css entity.other.attribute-name.pseudo-class",
              "entity.other.attribute-name.pseudo-element.css",
              "source.css.less entity.other.attribute-name.id",
              "entity.other.attribute-name.scss",
            ],
            settings: {
              foreground: "#d7ba7d",
            },
          },
          {
            scope: "invalid",
            settings: {
              foreground: "#f44747",
            },
          },
          {
            scope: "markup.underline",
            settings: {
              fontStyle: "underline",
            },
          },
          {
            scope: "markup.bold",
            settings: {
              fontStyle: "bold",
              foreground: "#569cd6",
            },
          },
          {
            scope: "markup.heading",
            settings: {
              fontStyle: "bold",
              foreground: "#569cd6",
            },
          },
          {
            scope: "markup.italic",
            settings: {
              fontStyle: "italic",
            },
          },
          {
            scope: "markup.strikethrough",
            settings: {
              fontStyle: "strikethrough",
            },
          },
          {
            scope: "markup.inserted",
            settings: {
              foreground: "#b5cea8",
            },
          },
          {
            scope: "markup.deleted",
            settings: {
              foreground: "#fff",
            },
          },
          {
            scope: "markup.changed",
            settings: {
              foreground: "#569cd6",
            },
          },
          {
            scope: "punctuation.definition.quote.begin.markdown",
            settings: {
              foreground: "#6A9955",
            },
          },
          {
            scope: "punctuation.definition.list.begin.markdown",
            settings: {
              foreground: "#6796e6",
            },
          },
          {
            scope: "markup.inline.raw",
            settings: {
              foreground: "#fff",
            },
          },
          {
            scope: "punctuation.definition.tag",
            settings: {
              foreground: "#808080",
            },
          },
          {
            scope: ["meta.preprocessor", "entity.name.function.preprocessor"],
            settings: {
              foreground: "#569cd6",
            },
          },
          {
            scope: "meta.preprocessor.string",
            settings: {
              foreground: "#fff",
            },
          },
          {
            scope: "meta.preprocessor.numeric",
            settings: {
              foreground: "#b5cea8",
            },
          },

          {
            scope: "meta.diff.header",
            settings: {
              foreground: "#569cd6",
            },
          },
          {
            scope: "storage",
            settings: {
              foreground: "#569cd6",
            },
          },
          {
            scope: "storage.type",
            settings: {
              foreground: "#FA7B6A",
            },
          },
          {
            scope: ["storage.modifier", "keyword.operator.noexcept"],
            settings: {
              foreground: "#569cd6",
            },
          },
          {
            scope: ["string"],
            settings: {
              foreground: "#46F488",
            },
          },
          {
            scope: "string.tag",
            settings: {
              foreground: "#46F488",
            },
          },
          {
            scope: "string.value",
            settings: {
              foreground: "#46F488",
            },
          },
          {
            scope: "string.regexp",
            settings: {
              foreground: "#d16969",
            },
          },
          {
            scope: [
              "punctuation.definition.template-expression.begin",
              "punctuation.definition.template-expression.end",
              "punctuation.section.embedded",
            ],
            settings: {
              foreground: "#569cd6",
            },
          },
          {
            scope: ["meta.template.expression"],
            settings: {
              foreground: "#d4d4d4",
            },
          },
          {
            scope: [
              "support.type.vendored.property-name",
              "support.type.property-name",
              "source.css variable",
              "source.coffee.embedded",
            ],
            settings: {
              foreground: "#9cdcfe",
            },
          },
          {
            scope: "keyword",
            settings: {
              foreground: "#569cd6",
            },
          },
          {
            scope: "keyword.control",
            settings: {
              foreground: "#569cd6",
            },
          },
          {
            scope: "keyword.operator",
            settings: {
              foreground: "#d4d4d4",
            },
          },
          {
            scope: [
              "keyword.operator.new",
              "keyword.operator.expression",
              "keyword.operator.cast",
              "keyword.operator.sizeof",
              "keyword.operator.alignof",
              "keyword.operator.typeid",
              "keyword.operator.alignas",
              "keyword.operator.instanceof",
              "keyword.operator.logical.python",
              "keyword.operator.wordlike",
            ],
            settings: {
              foreground: "#FA7B6A",
            },
          },
          {
            scope: "keyword.other.unit",
            settings: {
              foreground: "#b5cea8",
            },
          },
          {
            scope: [
              "punctuation.section.embedded.begin.php",
              "punctuation.section.embedded.end.php",
            ],
            settings: {
              foreground: "#569cd6",
            },
          },
          {
            scope: "support.function.git-rebase",
            settings: {
              foreground: "#9cdcfe",
            },
          },
          {
            scope: "constant.sha.git-rebase",
            settings: {
              foreground: "#b5cea8",
            },
          },
          {
            scope: [
              "storage.modifier.import.java",
              "variable.language.wildcard.java",
              "storage.modifier.package.java",
            ],
            settings: {
              foreground: "#d4d4d4",
            },
          },
          {
            scope: "variable.language",
            settings: {
              foreground: "#569cd6",
            },
          },
          {
            scope: [
              "support.function",
              "support.constant.handlebars",
              "source.powershell variable.other.member",
              "entity.name.operator.custom-literal",
            ],
            settings: {
              foreground: "#fff",
            },
          },
          {
            scope: ["entity.name.function", "constant.other"],
            settings: {
              foreground: "#D06BEE",
            },
          },
          {
            scope: [
              "support.class",
              "support.type",
              "entity.name.type",
              "entity.name.namespace",
              "entity.other.attribute",
              "entity.name.scope-resolution",
              "entity.name.class",
              "storage.type.numeric.go",
              "storage.type.byte.go",
              "storage.type.boolean.go",
              "storage.type.string.go",
              "storage.type.uintptr.go",
              "storage.type.error.go",
              "storage.type.rune.go",
              "storage.type.cs",
              "storage.type.generic.cs",
              "storage.type.modifier.cs",
              "storage.type.variable.cs",
              "storage.type.annotation.java",
              "storage.type.generic.java",
              "storage.type.java",
              "storage.type.object.array.java",
              "storage.type.primitive.array.java",
              "storage.type.primitive.java",
              "storage.type.token.java",
              "storage.type.groovy",
              "storage.type.annotation.groovy",
              "storage.type.parameters.groovy",
              "storage.type.generic.groovy",
              "storage.type.object.array.groovy",
              "storage.type.primitive.array.groovy",
              "storage.type.primitive.groovy",
            ],
            settings: {
              foreground: "#4EC9B0",
            },
          },
          {
            scope: [
              "entity.name.command.shell",
              "meta.statement.shell",
              "entity.name.function.call.shell",
            ],
            settings: {
              foreground: "#fff",
            },
          },
          {
            scope: ["string.unquoted.argument.shell", "meta.argument.shell"],
            settings: {
              foreground: "#fff",
            },
          },

          {
            scope: [
              "meta.type.cast.expr",
              "meta.type.new.expr",
              "support.constant.math",
              "support.constant.dom",
              "support.constant.json",
              "entity.other.inherited-class",
              "punctuation.separator.namespace.ruby",
            ],
            settings: {
              foreground: "#4EC9B0",
            },
          },
          {
            scope: [
              "keyword.control",
              "source.cpp keyword.operator.new",
              "keyword.operator.delete",
              "keyword.other.using",
              "keyword.other.directive.using",
              "keyword.other.operator",
              "entity.name.operator",
            ],
            settings: {
              foreground: "#C586C0",
            },
          },
          {
            scope: ["keyword.control.import", "keyword.control.export"],
            settings: {
              foreground: "#FA7B6A",
            },
          },
          {
            scope: [
              "meta.definition.variable.name",
              "support.variable",
              "entity.name.variable",
              "constant.other.placeholder",
            ],
            settings: {
              foreground: "#9CDCFE",
            },
          },
          {
            scope: ["variable.other.constant", "variable.other.enummember"],
            settings: {
              foreground: "#fff",
            },
          },
          {
            scope: ["meta.object-literal.key", "meta.object.member"],
            settings: {
              foreground: "#fff",
            },
          },
          {
            scope: [
              "support.constant.property-value",
              "support.constant.font-name",
              "support.constant.media-type",
              "support.constant.media",
              "constant.other.color.rgb-value",
              "constant.other.rgb-value",
              "support.constant.color",
            ],
            settings: {
              foreground: "#fff",
            },
          },
          {
            scope: [
              "punctuation.definition.group.regexp",
              "punctuation.definition.group.assertion.regexp",
              "punctuation.definition.character-class.regexp",
              "punctuation.character.set.begin.regexp",
              "punctuation.character.set.end.regexp",
              "keyword.operator.negation.regexp",
              "support.other.parenthesis.regexp",
            ],
            settings: {
              foreground: "#fff",
            },
          },
          {
            scope: [
              "constant.character.character-class.regexp",
              "constant.other.character-class.set.regexp",
              "constant.other.character-class.regexp",
              "constant.character.set.regexp",
            ],
            settings: {
              foreground: "#d16969",
            },
          },
          {
            scope: [
              "keyword.operator.or.regexp",
              "keyword.control.anchor.regexp",
            ],
            settings: {
              foreground: "#fff",
            },
          },
          {
            scope: "keyword.operator.quantifier.regexp",
            settings: {
              foreground: "#d7ba7d",
            },
          },

          {
            scope: "constant.character.escape",
            settings: {
              foreground: "#d7ba7d",
            },
          },
          {
            scope: "entity.name.label",
            settings: {
              foreground: "#C8C8C8",
            },
          },
          {
            scope: [
              "storage.modifier.async.ts",
              "storage.type.async",
              "keyword.control.loop",
              "keyword.control.from",
              "keyword.control.flow",
            ],
            settings: {
              foreground: "#FA7B6A",
            },
          },
          {
            scope: ["punctuation.definition"],
            settings: {
              foreground: "#fff",
            },
          },
          {
            scope: ["keyword.control.trycatch", "keyword.control.as"],
            settings: {
              foreground: "#D06BEE",
            },
          },
          {
            scope: ["entity.name.type", "support.type.primitive"],
            settings: {
              foreground: "#46F488",
            },
          },
        ],
        type: "dark",
      },
    },
  },
});

export default withNextra({
  assetPrefix: process.env.NODE_ENV === "production" ? "/docs" : "",
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/docs/_next/:path+",
          destination: "/_next/:path+",
        },
      ],
    };
  },
  redirects: () => [
    {
      source: "/docs/08-running-evals",
      destination: "/docs/evals/overview",
      permanent: true,
    },
    {
      source: "/docs/agents/00-overview",
      destination: "/docs/agents/overview",
      permanent: true,
    },
    {
      source: "/docs/agents/01-agent-memory",
      destination: "/docs/agents/agent-memory",
      permanent: true,
    },
    {
      source: "/docs/agents/02-adding-tools",
      destination: "/docs/agents/adding-tools",
      permanent: true,
    },
    {
      source: "/docs/agents/02a-mcp-guide",
      destination: "/docs/agents/mcp-guide",
      permanent: true,
    },
    {
      source: "/docs/agents/03-adding-voice",
      destination: "/docs/agents/adding-voice",
      permanent: true,
    },
    {
      source: "/docs/evals/00-overview",
      destination: "/docs/evals/overview",
      permanent: true,
    },
    {
      source: "/docs/evals/01-textual-evals",
      destination: "/docs/evals/textual-evals",
      permanent: true,
    },
    {
      source: "/docs/evals/02-custom-eval",
      destination: "/docs/evals/custom-eval",
      permanent: true,
    },
    {
      source: "/docs/evals/03-running-in-ci",
      destination: "/docs/evals/running-in-ci",
      permanent: true,
    },
    {
      source: "/docs/frameworks/01-next-js",
      destination: "/docs/frameworks/next-js",
      permanent: true,
    },
    {
      source: "/docs/frameworks/02-ai-sdk",
      destination: "/docs/frameworks/ai-sdk",
      permanent: true,
    },
    {
      source: "/docs/guides/01-chef-michel",
      destination: "/docs/guides/chef-michel",
      permanent: true,
    },
    {
      source: "/docs/guides/02-stock-agent",
      destination: "/docs/guides/stock-agent",
      permanent: true,
    },
    {
      source: "/docs/guides/03-recruiter",
      destination: "/docs/guides/ai-recruiter",
      permanent: true,
    },
    {
      source: "/docs/guides/04-research-assistant",
      destination: "/docs/guides/research-assistant",
      permanent: true,
    },
    {
      source: "/docs/workflows/00-overview",
      destination: "/docs/workflows/overview",
      permanent: true,
    },
  ],
  trailingSlash: false,
});
