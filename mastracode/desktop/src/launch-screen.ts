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
    <meta name="color-scheme" content="dark" />
    <title>MastraCode Desktop Alpha</title>
    <style>
      :root {
        color-scheme: dark;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #050706;
        color: #f3f7f4;
      }

      * { box-sizing: border-box; }

      html, body { width: 100%; height: 100%; }

      body {
        margin: 0;
        overflow: hidden;
        background: #050706;
      }

      .screen {
        position: relative;
        display: grid;
        min-height: 100%;
        place-items: center;
        isolation: isolate;
      }

      .atmosphere,
      .grain {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }

      .atmosphere {
        z-index: -2;
        inset: -18%;
        background: radial-gradient(ellipse at 48% 44%, rgba(47, 215, 112, 0.065), rgba(5, 7, 6, 0) 50%);
        transform: translate3d(-2%, -1%, 0) scale(1.04);
        animation: atmosphere-drift 12s cubic-bezier(0.37, 0, 0.63, 1) infinite alternate;
      }

      .grain {
        z-index: -1;
        background-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAAWlBMVEX///8AAABaWlrq6uq9vb3n5+eBgYHc3Nyzs7MaGhpubm739/coKChNTU2mpqYjIyOUlJRFRUXR0dEwMDA6OjpQUFCtra3Dw8N4eHiLi4sUFBRiYmLIyMgKCgqS0997AAAArElEQVQY0yWOW5bDIAxDrygNCVDIo6SdJLP/bY7J/NhHki0J5B6ep4YwTi4GoZgS+VVQB0xI4FGdl3XTu+3ok75im5tM2qFf/GTcXg9jWn7CcAteOuWURaDEkwM1FV1ab9PKMGpd5XJYIBiV6JbO7H4tEh3xkj50s8XmwHnysM//Ul8uKEzzEmj9xkh/6dXrmJBmbBuwMnfHMMExVlVD5U6C+N6UKcPm/dED/wDF6gcZYV1/UgAAAABJRU5ErkJggg==");
        background-size: 16px 16px;
        mix-blend-mode: soft-light;
        opacity: 0.022;
      }

      .content {
        position: relative;
        z-index: 1;
        display: flex;
        width: min(340px, calc(100vw - 80px));
        flex-direction: column;
        align-items: center;
      }

      .icon-shell {
        display: grid;
        width: 124px;
        height: 124px;
        place-items: center;
        animation: icon-in 1450ms cubic-bezier(0.16, 1, 0.3, 1) both;
      }

      .icon {
        display: block;
        width: 100%;
        height: 100%;
        border-radius: 28px;
        object-fit: cover;
        animation: breathe 4200ms 1450ms cubic-bezier(0.25, 1, 0.5, 1) infinite alternate;
      }

      .copy {
        display: flex;
        margin-top: 26px;
        flex-direction: column;
        align-items: center;
        gap: 7px;
        text-align: center;
        animation: copy-in 820ms 680ms cubic-bezier(0.16, 1, 0.3, 1) both;
      }

      .brand {
        font-size: 15px;
        font-weight: 650;
        line-height: 1.2;
      }

      .status {
        color: #98a69d;
        font-size: 12px;
        line-height: 1.4;
      }

      @keyframes atmosphere-drift {
        from { opacity: 0.72; transform: translate3d(-2%, -1%, 0) scale(1.04); }
        to { opacity: 1; transform: translate3d(3%, 2%, 0) scale(1.1); }
      }

      @keyframes icon-in {
        0% { opacity: 0; filter: blur(22px); transform: translateY(20px) scale(0.7); }
        60% { opacity: 1; filter: blur(2px); }
        100% { opacity: 1; filter: blur(0); transform: translateY(0) scale(1); }
      }

      @keyframes copy-in {
        from { opacity: 0; filter: blur(4px); transform: translateY(8px); }
        to { opacity: 1; filter: blur(0); transform: translateY(0); }
      }

      @keyframes breathe {
        from { filter: saturate(0.94) brightness(0.98); transform: scale(0.992); }
        to { filter: saturate(1.03) brightness(1.02); transform: scale(1); }
      }

      @media (prefers-reduced-motion: reduce) {
        .atmosphere, .icon-shell, .icon, .copy { animation: none; }
      }
    </style>
  </head>
  <body>
    <main class="screen" role="status" aria-label="${LAUNCH_SCREEN_ACCESSIBLE_NAME}" aria-live="polite">
      <span class="atmosphere" aria-hidden="true"></span>
      <span class="grain" aria-hidden="true"></span>
      <section class="content">
        <span class="icon-shell" aria-hidden="true"><img class="icon" src="${iconDataUrl}" alt="" /></span>
        <div class="copy">
          <strong class="brand">MastraCode</strong>
          <span class="status">Starting local workspace</span>
        </div>
      </section>
    </main>
  </body>
</html>`;

  return `data:text/html;charset=UTF-8,${encodeURIComponent(html)}`;
}
