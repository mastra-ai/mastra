/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMDXComponents as getThemeComponents } from "nextra-theme-docs"; // nextra-theme-blog or your custom theme
import { OperatorsTable } from "./components/operators-table";
import { PropertiesTable } from "./components/properties-table";

// Get the default MDX components
const themeComponents = getThemeComponents();

// Merge components
export function useMDXComponents(components?: any) {
  return {
    ...themeComponents,
    ...components,
    OperatorsTable,
    PropertiesTable,
  };
}
