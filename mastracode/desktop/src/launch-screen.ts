const LAUNCH_SCREEN_IMAGE_PATTERN = /^data:image\/(?:png|jpeg|webp);base64,/;

export const LAUNCH_SCREEN_ACCESSIBLE_NAME = 'Starting MastraCode';

export function createLaunchScreenDataUrl(iconDataUrl: string): string {
  if (!LAUNCH_SCREEN_IMAGE_PATTERN.test(iconDataUrl)) {
    throw new Error('MastraCode launch screen requires an embedded image');
  }

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"
    />
    <title>MastraCode Desktop Alpha</title>
    <style>
      :root {
        background: transparent;
      }

      * { box-sizing: border-box; }

      html, body { width: 100%; height: 100%; }

      body {
        margin: 0;
        overflow: hidden;
        background: transparent;
      }

      .screen {
        position: relative;
        display: grid;
        min-height: 100%;
        place-items: center;
      }

      .halo {
        position: absolute;
        width: 156px;
        height: 156px;
        border-radius: 48px;
        background: radial-gradient(circle, rgba(45, 234, 123, 0.18), rgba(45, 234, 123, 0) 68%);
        filter: blur(24px);
        opacity: 0;
        pointer-events: none;
        animation: halo-in 1600ms 160ms cubic-bezier(0.16, 1, 0.3, 1) both;
      }

      .icon-shell {
        display: grid;
        width: 132px;
        height: 132px;
        place-items: center;
        animation: icon-in 1600ms cubic-bezier(0.16, 1, 0.3, 1) both;
      }

      .icon {
        display: block;
        width: 100%;
        height: 100%;
        border-radius: 30px;
        object-fit: cover;
        filter: drop-shadow(0 20px 30px rgba(0, 0, 0, 0.28));
        animation: breathe 3600ms 1600ms cubic-bezier(0.25, 1, 0.5, 1) infinite alternate;
      }

      @keyframes halo-in {
        0% { opacity: 0; transform: scale(0.7); }
        100% { opacity: 0.7; transform: scale(1); }
      }

      @keyframes icon-in {
        0% { opacity: 0; filter: blur(18px); transform: translateY(14px) scale(0.72); }
        62% { opacity: 1; filter: blur(1.5px); }
        100% { opacity: 1; filter: blur(0); transform: translateY(0) scale(1); }
      }

      @keyframes breathe {
        from { transform: scale(0.992); }
        to { transform: scale(1); }
      }

      @media (prefers-reduced-motion: reduce) {
        .halo, .icon-shell, .icon { animation: none; }
        .halo { opacity: 0.7; }
      }
    </style>
  </head>
  <body>
    <main class="screen" role="status" aria-label="${LAUNCH_SCREEN_ACCESSIBLE_NAME}" aria-live="polite">
      <span class="halo" aria-hidden="true"></span>
      <span class="icon-shell" aria-hidden="true"><img class="icon" src="${iconDataUrl}" alt="" /></span>
    </main>
  </body>
</html>`;

  return `data:text/html;charset=UTF-8,${encodeURIComponent(html)}`;
}
