// Temporarily disables all CSS transitions on the page.
// Based on: https://paco.me/writing/disable-theme-transitions
export function disableTransitions(): () => void {
  const css = document.createElement("style");
  css.appendChild(
    document.createTextNode(
      `* {
        -webkit-transition: none !important;
        -moz-transition: none !important;
        -o-transition: none !important;
        -ms-transition: none !important;
        transition: none !important;
      }`,
    ),
  );
  document.head.appendChild(css);

  return () => {
    // @ts-ignore
    const _ = window.getComputedStyle(css).opacity;
    document.head.removeChild(css);
  };
}
