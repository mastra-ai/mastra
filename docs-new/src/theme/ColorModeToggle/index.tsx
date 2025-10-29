import React from "react";
import clsx from "clsx";
import useIsBrowser from "@docusaurus/useIsBrowser";
import { translate } from "@docusaurus/Translate";
import IconLightMode from "@theme/Icon/LightMode";
import IconDarkMode from "@theme/Icon/DarkMode";
import { disableTransitions } from "@site/src/utils/disableTransitions";

import type { Props } from "@theme/ColorModeToggle";

function ColorModeToggle({
  className,
  buttonClassName,
  value,
  onChange,
}: Props): React.JSX.Element {
  const isBrowser = useIsBrowser();

  const title = translate(
    {
      message: "Switch between dark and light mode (currently {mode})",
      id: "theme.colorToggle.ariaLabel",
      description: "The ARIA label for the navbar color mode toggle",
    },
    {
      mode:
        value === "dark"
          ? translate({
              message: "dark mode",
              id: "theme.colorToggle.ariaLabel.mode.dark",
              description: "The name for the dark color mode",
            })
          : translate({
              message: "light mode",
              id: "theme.colorToggle.ariaLabel.mode.light",
              description: "The name for the light color mode",
            }),
    },
  );

  const handleChange = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!isBrowser) {
      return;
    }

    const enableTransitions = disableTransitions();
    onChange(value === "dark" ? "light" : "dark");
    setTimeout(() => {
      enableTransitions();
    }, 0);
  };

  return (
    <button
      className={clsx("clean-btn", className, buttonClassName)}
      type="button"
      onClick={handleChange}
      disabled={!isBrowser}
      title={title}
      aria-label={title}
      aria-live="polite"
    >
      <IconLightMode className={clsx("lightToggleIcon")} />
      <IconDarkMode className={clsx("darkToggleIcon")} />
    </button>
  );
}

export default React.memo(ColorModeToggle);
