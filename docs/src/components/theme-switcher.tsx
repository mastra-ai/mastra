import React from "react";
import { useColorMode } from "@docusaurus/theme-common";
import { disableTransitions } from "../utils/disableTransitions";

export const ThemeSwitcher = () => {
  const { colorMode, setColorMode } = useColorMode();

  const toggleTheme = () => {
    const enableTransitions = disableTransitions();
    setColorMode(colorMode === "light" ? "dark" : "light");
    setTimeout(() => {
      enableTransitions();
    }, 0);
  };

  const getAriaLabel = () => {
    return colorMode === "light"
      ? "Switch to dark theme"
      : "Switch to light theme";
  };

  return (
    <button
      onClick={toggleTheme}
      className="w-fit hover:bg-(--mastra-surface-3) hover:dark:bg-[#121212] text-black hover:text-black dark:text-white dark:hover:text-white transition-colors ease-linear p-2 rounded-[10px] cursor-pointer border-0 bg-transparent"
      aria-label={getAriaLabel()}
      title={getAriaLabel()}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-4.5"
      >
        <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
        <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"></path>
        <path d="M12 3l0 18"></path>
        <path d="M12 9l4.65 -4.65"></path>
        <path d="M12 14.3l7.37 -7.37"></path>
        <path d="M12 19.6l8.85 -8.85"></path>
      </svg>
      <span className="sr-only">{getAriaLabel()}</span>
    </button>
  );
};
