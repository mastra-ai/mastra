# Youch

> Pretty print JavaScript errors on the Web and the Terminal

<br />

[![gh-workflow-image]][gh-workflow-url] [![npm-image]][npm-url] ![][typescript-image] [![license-image]][license-url] [![Downloads Stats][npm-downloads-image]][npm-url]

![](./assets/banner.png)

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**

- [What is Youch?](#what-is-youch)
- [Usage](#usage)
  - [Render error to HTML output](#render-error-to-html-output)
  - [Render error to ANSI output](#render-error-to-ansi-output)
- [Anatomy of the error page](#anatomy-of-the-error-page)
  - [Error info](#error-info)
  - [Stack trace](#stack-trace)
  - [Raw output](#raw-output)
  - [Error cause](#error-cause)
  - [Metadata (HTML only)](#metadata-html-only)
- [Using a custom source code loader](#using-a-custom-source-code-loader)
- [Injecting custom styles](#injecting-custom-styles)
- [Overriding syntax highlighter](#overriding-syntax-highlighter)
- [Configuring code editors](#configuring-code-editors)
  - [How do you detect the user's code editor?](#how-do-you-detect-the-users-code-editor)
- [Contributing](#contributing)
- [Code of Conduct](#code-of-conduct)
- [License](#license)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## What is Youch?

Youch is an error-parsing library that pretty prints JavaScript errors on a web page or the terminal.

As you can see in the following screenshots, the error presented by Youch is a lot more readable and presentable in comparison to the unformatted stack trace.

<table>
  <tbody>
    <tr>
      <td>
        <strong>Unformatted stack trace</strong>
      </td>
    </tr>
    <tr>
      <td>
        <img src="./assets/raw-stack-trace.png" />
      </td>
    </tr>
    <tr>
      <td>
        <strong>Youch output</strong>
      </td>
    </tr>
    <tr>
      <td>
        <img src="./assets/youch-output.jpg" />
      </td>
    </tr>
  </tbody>
<table>

## Usage

Install the package from the npm packages registry as follows.

```sh
npm i youch@beta

# Yarn
yarn add youch@beta

# Pnpm
pnpm add youch@beta
```

### Render error to HTML output

You can render errors to HTML output using the `youch.toHTML` method. The HTML output is self-contained and does not require separate CSS or JavaScript files.

In the following example, we use the `hono` framework and pretty print all the errors in development using Youch. You can replace Hono with any other framework of your choice.

```ts
import { Hono } from 'hono'
import { Youch } from 'youch'

const app = new Hono()
const IN_DEV = process.env.NODE_ENV === 'development'

app.onError(async (error, c) => {
  if (IN_DEV) {
    const youch = new Youch()
    const html = await youch.toHTML(error)
    return c.html(html)
  }
  return c.text(error.message)
})
```

The `youch.toHTML` method accepts the error as the first argument and the following options as the second argument.

```ts
await youch.toHTML(error, {
  title: 'An error occurred',
  cspNonce: '',
  offset: 0,
  ide: 'vscode',
})
```

| Option     | Description                                                                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `title`    | Define the title for the error page. It defaults to **"An error has occurred"**                                                                                                |
| `cspNonce` | If your application is using CSP protection, then you must provide the [CSP-nonce](https://content-security-policy.com/nonce/) for rendering inline `style` and `script` tags. |
| `offset`   | The offset can be used to skip displaying certain frames from the parsed error stack.                                                                                          |
| `ide`      | The `ide` option defines the code editor for opening the files when the filename anchor tag is clicked. [Learn more about configuring code editors](#configuring-code-editors) |

### Render error to ANSI output

You can render an error to ANSI output (for terminal) using the `youch.toANSI` method.

```ts
try {
  await performSomeAction()
} catch (error) {
  const youch = new Youch()
  const ansiOutput = await youch.toANSI(error)

  console.error(ansiOutput)
}
```

The `youch.toANSI` method accepts the error as the first argument and the following options as the second argument.

```ts
await youch.toANSI(error, {
  offset: 0,
})
```

| Option   | Description                                                                           |
| -------- | ------------------------------------------------------------------------------------- |
| `offset` | The offset can be used to skip displaying certain frames from the parsed error stack. |

## Anatomy of the error page

Let's deconstruct the error page and understand what each section of the output represents.

### Error info

The top-most section displays the Error info, which includes:

- The Error class constructor name.
- The Error title. It is set using the `options.title` property.
- And the Error message (highlighted in red).

<details>
  <summary><strong>View HTML output</strong></summary>
  
  ![](./assets/error-info.png)

</details>

---

### Stack trace

The Stack trace section displays individual frames as accordion sections. Clicking on the section title reveals the frame source code. The source code is unavailable for native stack frames that are part of the Node.js, Deno, and Bun internals.

<details>
  <summary><strong>View HTML output</strong></summary>
  
  ![](./assets/error-stack.png)

</details>

---

For the ANSI output, only the first frame from the application code is expanded to show the source code.

<details>
  <summary><strong>View ANSI output</strong></summary>
  
  ![](./assets/terminal-error.png)

</details>

---

### Raw output

Clicking the `Raw` button displays the Error object in its raw form, with all the error properties (not just the stack trace).

The raw output may be helpful for errors that contain additional properties. HTTP client libraries like Axios, Got, Undici, and others usually contain the HTTP response details within the error object.

<details>
  <summary><strong>View HTML output</strong></summary>
  
  ![](./assets/stack-raw-output.png)

</details>

---

In case of ANSI output, you can view the raw output using the `YOUCH_RAW` environment variable. For example: `YOUCH_RAW=true node your-script.js`.

<details>
  <summary><strong>View ANSI output</strong></summary>
  
  ![](./assets/terminal-error-raw.png)

</details>

---

### Error cause

[Error cause](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause) is a standard way to bubble errors while wrapping them within a generic error. Youch displays the error cause as an interactive property within its own section.

<details>
  <summary><strong>View HTML output</strong></summary>
  
  ![](./assets/error-cause.png)

</details>

---

For the ANSI output, the nested properties are shown upto the two levels deep. However, you can adjust the depth using the `YOUCH_CAUSE` environment variable. For example: `YOUCH_CAUSE=4 node your-script.js`.

<details>
  <summary><strong>View ANSI output</strong></summary>
  
  ![](./assets/terminal-error-cause.png)

</details>

---

### Metadata (HTML only)

Metadata refers to any additional data that you want to display on the error page. It could be the HTTP request headers, the logged-in user info, or the list of available application routes.

Metadata is structured as groups and sections. Each section contains an array of rows, and each row is composed of a `key-value` pair.

In the following example, we display the request headers under the `Request` group and the `Headers` section.

```ts
const youch = new Youch()

youch.group('Request', {
  headers: [
    {
      key: 'cookie',
      value: req.headers.cookie,
    },
    {
      key: 'host',
      value: req.headers.host,
    },
  ],
})
```

Calling the `youch.group` method multiple times with the same group name will merge the new sections with existing sections.

## Using a custom source code loader

Youch reads the source code of files within the stack trace using the Node.js `fs` module. However, you can override this default and provide a custom source loader using the `youch.sourceLoader` method.

> Note: The `sourceLoader` is called for every frame within the stack traces. Therefore, you must perform the necessary checks before attempting to read the source code of a file.
>
> For example, you must not attempt to read the source code for fileNames pointing to native code.

```ts
import { Youch } from 'youch'
const youch = new Youch(options)

youch.sourceLoader(async (stackFrame) => {
  if (stackFrame.type !== 'native') {
    stackFrame.source = await getSourceForFile(stackFrame.fileName)
  }
})
```

## Injecting custom styles

You may inject custom CSS styles using the `youch.templates.injectStyles` method. The styles will be injected after the styles from the inbuilt templates.

```ts
import { Youch } from 'youch'
const youch = new Youch(options)

youch.templates.injectStyles(`
  :root {
    // Override variables for light mode
    --surface-bg: #fff;
    --surface-fg: #000;
    --muted-fg: #999;
  }

  html.dark {
    // Override variables for dark mode
  }
`)
```

## Overriding syntax highlighter

Youch uses [speed-highlight](https://github.com/speed-highlight/core), a lightweight code highlighting library for JavaScript. To override the syntax highlighter, you can register a custom component for the `errorStackSource` template.

In the following example, we use [Shiki](https://shiki.matsu.io/) to perform syntax highlighting using a custom component.

```ts
import { codeToHtml } from 'shiki'
import { ErrorStackSourceProps } from 'youch/types'
import { ErrorStackSource } from 'youch/templates/error_stack_source'

/**
 * A custom component that uses shiki to render the source
 * code snippet for a stack frame
 */
class CustomErrorStackSource<ErrorStackSourceProps> extends ErrorStackSource {
  /**
   * Return the styles you want to inject from this
   * component
   */
  async getStyles() {
    return `
    html.dark .shiki {
      background-color: var(--shiki-dark-bg) !important;
    }

    html.dark .shiki span {
      color: var(--shiki-dark) !important;
      font-weight: var(--shiki-dark-font-weight) !important;
      text-decoration: var(--shiki-dark-text-decoration) !important;
    }

    pre.shiki {
      padding: 16px 0;
    }

    code .line {
      position: relative;
      padding: 0 16px 0 48px;
      height: 24px;
      line-height: 24px;
      width: 100%;
      display: inline-block;
    }

    code .line:before {
      position: absolute;
      content: attr(data-line);
      opacity: 0.5;
      text-align: right;
      margin-right: 5px;
      left: 0;
      width: 32px;
    }

    code .highlighted {
      background-color: #ff000632;
    }

    html.dark code .highlighted {
      background-color: #ff173f2d !important;
    }`
  }

  async toHTML(props: ErrorStackSourceProps) {
    if (props.frame.source) {
      const code = props.frame.source.map(({ chunk }) => chunk).join('\n')

      return codeToHtml(code, {
        lang: 'typescript',
        themes: {
          light: 'min-light',
          dark: 'vitesse-dark',
        },
        transformers: [
          {
            line(node, line) {
              const lineNumber = props.frame.source![line - 1].lineNumber
              node.properties['data-line'] = lineNumber

              if (lineNumber === props.frame.lineNumber) {
                this.addClassToHast(node, 'highlighted')
              }
            },
          },
        ],
      })
    }

    return ''
  }
}

const youch = new Youch()

/**
 * Register the component
 */
youch.templates.use('errorStackSource', new CustomErrorStackSource(false))

const html = await youch.toHTML(error)
```

## Configuring code editors

When you click the filename anchor tag (displayed in the pretty error stack section), Youch will attempt to open the given file inside a pre-configured code editor (defaults to `vscode`).

You can specify which code editor to use via the `ide` option. Following is the list of support code editors.

- textmate
- macvim
- emacs
- sublime
- phpstorm
- atom
- vscode

If you prefer a different code editor, specify its URL via the `ide` option. Make sure the URL contains the `%f` placeholder for the filename and the `%l` placeholder for the line number.

```ts
await youch.toHTML(error, {
  ide: 'mvim://open?url=file://%f&line=%l',
})
```

### How do you detect the user's code editor?

Youch relies on the `process.env.IDE` environment variable to detect the user's code editor and falls back to `vscode` if the environment variable is not defined.

However, you can use any detection logic and specify the detected code editor via the `ide` option. For example, In the case of AdonisJS, we configure the code editor within the `.env` file using the `ADONIS_IDE` environment variable.

## Contributing

One of the primary goals of Poppinss is to have a vibrant community of users and contributors who believe in the principles of the framework.

We encourage you to read the [contribution guide](https://github.com/poppinss/.github/blob/main/docs/CONTRIBUTING.md) before contributing to the framework.

## Code of Conduct

In order to ensure that the Poppinss community is welcoming to all, please review and abide by the [Code of Conduct](https://github.com/poppinss/.github/blob/main/docs/CODE_OF_CONDUCT.md).

## License

Youch is open-sourced software licensed under the [MIT license](LICENSE.md).

[gh-workflow-image]: https://img.shields.io/github/actions/workflow/status/poppinss/youch/checks.yml?style=for-the-badge
[gh-workflow-url]: https://github.com/poppinss/youch/actions/workflows/checks.yml 'Github action'
[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: "typescript"
[npm-image]: https://img.shields.io/npm/v/youch.svg?style=for-the-badge&logo=npm
[npm-url]: https://npmjs.org/package/youch 'npm'
[license-image]: https://img.shields.io/npm/l/youch?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md 'license'
[npm-downloads-image]: https://img.shields.io/npm/dm/youch.svg?style=for-the-badge
