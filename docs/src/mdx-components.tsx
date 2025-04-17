/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMDXComponents as getThemeComponents } from "nextra-theme-docs"; // nextra-theme-blog or your custom theme
import { OperatorsTable } from "./components/operators-table";
import { PropertiesTable } from "./components/properties-table";
import { Pre, withIcons} from "nextra/components"
import { IconBash, IconTs } from "./components/code-block-icons";

const themeComponents = getThemeComponents({
  pre: withIcons(Pre, { ts: IconTs, bash: IconBash })
});

// Merge components
export function useMDXComponents(components?: any) {
  return {
    ...themeComponents,
    ...components,
    OperatorsTable,
    PropertiesTable,
  };
}
