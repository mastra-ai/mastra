const STARTUP_ERROR_DETAILS_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_MASTRA_STUDIO_SHOW_STARTUP_ERROR_DETAILS === 'true';

type RenderStartupErrorOptions = {
  showDetails?: boolean;
};

function getStartupErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.stack || error.message;
  }

  return String(error);
}

export function renderStartupError(
  error: unknown,
  { showDetails = STARTUP_ERROR_DETAILS_ENABLED }: RenderStartupErrorOptions = {},
) {
  const root = document.getElementById('root');
  if (!root || root.childElementCount > 0) {
    return;
  }

  const wrapper = document.createElement('main');
  wrapper.setAttribute('role', 'alert');
  wrapper.style.cssText =
    'min-height:100vh;background:#0b0d10;color:#f4f4f5;font-family:"Mona Sans",ui-sans-serif,system-ui,sans-serif;font-feature-settings:"ss06" on;padding:32px;box-sizing:border-box;';

  const title = document.createElement('h1');
  title.textContent = 'Mastra Studio failed to start';
  title.style.cssText = 'font-size:20px;line-height:1.4;margin:0 0 8px;';

  const detail = document.createElement('p');
  detail.textContent = showDetails
    ? 'The startup module failed before React could render. Check the Vite terminal and browser console for the original request details.'
    : 'The startup module failed before React could render. Run Studio in development mode to view detailed diagnostics.';
  detail.style.cssText = 'color:#a1a1aa;max-width:760px;margin:0 0 20px;line-height:1.6;';

  wrapper.append(title, detail);

  if (showDetails) {
    const pre = document.createElement('pre');
    pre.textContent = getStartupErrorMessage(error);
    pre.style.cssText =
      'white-space:pre-wrap;overflow:auto;background:#18181b;border:1px solid #3f3f46;border-radius:8px;padding:16px;max-width:100%;line-height:1.5;';
    wrapper.append(pre);
  }

  root.replaceChildren(wrapper);
}
