import plugin from "tailwindcss/plugin.js";
import baseComponentsCSS from "../../dist/styles/tailwindcss/base-components.css.json" with { type: "json" };
import threadCSS from "../../dist/styles/tailwindcss/thread.css.json" with { type: "json" };
import modalCSS from "../../dist/styles/tailwindcss/modal.css.json" with { type: "json" };
import defaultThemeCSS from "../../dist/styles/themes/default.css.json" with { type: "json" };
import shadcnExtrasCSS from "../../dist/styles/themes/shadcn-extras.css.json" with { type: "json" };
import markdownCSS from "../../dist/styles/tailwindcss/markdown.css.json" with { type: "json" };

type AssistantTailwindPluginColors = {
  border: string;
  input: string;
  ring: string;
  background: string;
  foreground: string;
  primary: {
    DEFAULT: string;
    foreground: string;
  };
  secondary: {
    DEFAULT: string;
    foreground: string;
  };
  destructive: {
    DEFAULT: string;
    foreground: string;
  };
  muted: {
    DEFAULT: string;
    foreground: string;
  };
  accent: {
    DEFAULT: string;
    foreground: string;
  };
  popover: {
    DEFAULT: string;
    foreground: string;
  };
  card: {
    DEFAULT: string;
    foreground: string;
  };
};

type AssisstantTailwindPluginOptions = {
  components?: (
    | "default-theme"
    | "base"
    | "thread"
    | "assistant-modal"
    | "markdown"
  )[];
  colors?: AssistantTailwindPluginColors;
  shadcn?: boolean;
};

const auiPlugin = plugin.withOptions<AssisstantTailwindPluginOptions>(
  ({
    components = ["assistant-modal", "thread", "markdown"],
    shadcn = false,
  } = {}) =>
    ({ addComponents }) => {
      const assistantModal = components.includes("assistant-modal");
      const thread = assistantModal || components.includes("thread");
      const markdown = components.includes("markdown");
      const base = thread || components.includes("base");
      const defaultTheme = components.includes("default-theme");

      if (defaultTheme && shadcn)
        throw new Error("default-theme cannot be used with shadcn");

      if (defaultTheme || (base && !shadcn)) {
        addComponents(defaultThemeCSS);
      }
      if (!defaultTheme && base && shadcn) {
        addComponents(shadcnExtrasCSS);
      }

      if (base) {
        addComponents(baseComponentsCSS);
      }

      if (thread) {
        addComponents(threadCSS);
      }

      if (assistantModal) {
        addComponents(modalCSS);
      }

      if (markdown) {
        addComponents(markdownCSS);
      }
    },
  ({
    // components = ["assistant-modal", "thread"],
    colors = {},
    shadcn = false,
  } = {}) => {
    const prefix = !shadcn ? "--aui-" : "--";
    return {
      safelist: [{ pattern: /^aui-/ }],
      // ...(components.length > 0
      //   ? { safelist: [{ pattern: /^aui-/ }] }
      //   : undefined),
      theme: {
        extend: {
          maxWidth: {
            "aui-thread": "var(--aui-thread-max-width)",
          },
          colors: {
            aui: {
              border: colors.border ?? `hsl(var(${prefix}border))`,
              input: colors.input ?? `hsl(var(${prefix}input))`,
              ring: colors.ring ?? `hsl(var(${prefix}ring))`,
              background: colors.background ?? `hsl(var(${prefix}background))`,
              foreground: colors.foreground ?? `hsl(var(${prefix}foreground))`,
              primary: {
                DEFAULT:
                  colors.primary?.DEFAULT ?? `hsl(var(${prefix}primary))`,
                foreground:
                  colors.primary?.foreground ??
                  `hsl(var(${prefix}primary-foreground))`,
              },
              secondary: {
                DEFAULT:
                  colors.secondary?.DEFAULT ?? `hsl(var(${prefix}secondary))`,
                foreground:
                  colors.secondary?.foreground ??
                  `hsl(var(${prefix}secondary-foreground))`,
              },
              destructive: {
                DEFAULT:
                  colors.destructive?.DEFAULT ??
                  `hsl(var(${prefix}destructive))`,
                foreground: `hsl(var(${prefix}destructive-foreground))`,
              },
              muted: {
                DEFAULT: `hsl(var(${prefix}muted))`,
                foreground:
                  colors.muted?.foreground ??
                  `hsl(var(${prefix}muted-foreground))`,
              },
              accent: {
                DEFAULT: colors.accent?.DEFAULT ?? `hsl(var(${prefix}accent))`,
                foreground:
                  colors.accent?.foreground ??
                  `hsl(var(${prefix}accent-foreground))`,
              },
              popover: {
                DEFAULT:
                  colors.popover?.DEFAULT ?? `hsl(var(${prefix}popover))`,
                foreground:
                  colors.popover?.foreground ??
                  `hsl(var(${prefix}popover-foreground))`,
              },
              card: {
                DEFAULT: colors.card?.DEFAULT ?? `hsl(var(${prefix}card))`,
                foreground:
                  colors.card?.foreground ??
                  `hsl(var(${prefix}card-foreground))`,
              },
            },
          },
        },
      },
    };
  },
);

export default auiPlugin;
