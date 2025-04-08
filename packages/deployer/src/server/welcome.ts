export const html = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Welcome to Mastra</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/inter-ui/3.19.3/inter.min.css" />
    <style>
      body {
        margin: 0;
        padding: 0;
        background-color: #0d0d0d;
        color: #ffffff;
        font-family:
          'Inter',
          -apple-system,
          BlinkMacSystemFont,
          system-ui,
          sans-serif;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
      }

      main {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        text-align: center;
      }

      h1 {
        font-size: 4rem;
        font-weight: 600;
        margin: 0 0 1rem 0;
        background: linear-gradient(to right, #fff, #ccc);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        line-height: 1.2;
      }

      .subtitle {
        color: #9ca3af;
        font-size: 1.25rem;
        max-width: 600px;
        margin: 0 auto 3rem auto;
        line-height: 1.6;
      }

      .docs-link {
        background-color: #1a1a1a;
        padding: 1rem 2rem;
        border-radius: 0.5rem;
        display: flex;
        align-items: center;
        gap: 1rem;
        font-family: monospace;
        font-size: 1rem;
        color: #ffffff;
        text-decoration: none;
        transition: background-color 0.2s;
      }

      .docs-link:hover {
        background-color: #252525;
      }

      .arrow-icon {
        transition: transform 0.2s;
      }

      .docs-link:hover .arrow-icon {
        transform: translateX(4px);
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Welcome to Mastra</h1>
      <p class="subtitle">
        From the team that brought you Gatsby: prototype and productionize AI features with a modern JS/TS stack.
      </p>

      <a href="https://mastra.ai/docs" class="docs-link">
        Browse the docs
        <svg
          class="arrow-icon"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </a>
    </main>
  </body>
</html>
`;
