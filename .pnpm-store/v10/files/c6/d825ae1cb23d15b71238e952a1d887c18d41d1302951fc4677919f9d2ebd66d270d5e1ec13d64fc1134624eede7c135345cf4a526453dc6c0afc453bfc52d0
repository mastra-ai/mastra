# Swagger UI Middleware and Component for Hono

[![codecov](https://codecov.io/github/honojs/middleware/graph/badge.svg?flag=swagger-ui)](https://codecov.io/github/honojs/middleware)

This library, `@hono/swagger-ui`, provides a middleware and a component for integrating Swagger UI with Hono applications. Swagger UI is an interactive documentation interface for APIs compliant with the OpenAPI Specification, making it easier to understand and test API endpoints.

## Installation

```bash
npm install @hono/swagger-ui
# or
yarn add @hono/swagger-ui
```

## Usage

### Middleware Usage

You can use the `swaggerUI` middleware to serve Swagger UI on a specific route in your Hono application. Here's how you can do it:

```ts
import { Hono } from 'hono'
import { swaggerUI } from '@hono/swagger-ui'

const app = new Hono()

// Use the middleware to serve Swagger UI at /ui
app.get('/ui', swaggerUI({ url: '/doc' }))

export default app
```

### Component Usage

If you are using `hono/html`, you can use the `SwaggerUI` component to render Swagger UI within your custom HTML structure. Here's an example:

```ts
import { Hono } from 'hono'
import { html } from 'hono/html'
import { SwaggerUI } from '@hono/swagger-ui'

const app = new Hono()

app.get('/ui', (c) => {
  return c.html(`
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Custom Swagger" />
        <title>Custom Swagger</title>
        <script>
          // custom script
        </script>
        <style>
          /* custom style */
        </style>
      </head>
      ${SwaggerUI({ url: '/doc' })}
    </html>
  `)
})
export default app
```

In this example, the `SwaggerUI` component is used to render Swagger UI within a custom HTML structure, allowing for additional customization such as adding custom scripts and styles.

### With `OpenAPIHono` Usage

Hono's middleware has OpenAPI integration `@hono/zod-openapi`, so you can use it to create an OpenAPI document and serve it easily with Swagger UI.

```ts
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { swaggerUI } from '@hono/swagger-ui'

const app = new OpenAPIHono()

app.openapi(
  createRoute({
    method: 'get',
    path: '/hello',
    responses: {
      200: {
        description: 'Respond a message',
        content: {
          'application/json': {
            schema: z.object({
              message: z.string(),
            }),
          },
        },
      },
    },
  }),
  (c) => {
    return c.json({
      message: 'hello',
    })
  }
)

app.get(
  '/ui',
  swaggerUI({
    url: '/doc',
  })
)

app.doc('/doc', {
  info: {
    title: 'An API',
    version: 'v1',
  },
  openapi: '3.1.0',
})

export default app
```

## Options

Both the middleware and the component accept an options object for customization.

The following options are available:

- `version` (string, optional): The version of Swagger UI to use, defaults to `latest`.
- `manuallySwaggerUIHtml` (string, optional): If you want to use your own custom HTML, you can specify it here. If this option is specified, the all options except `version` will be ignored.

and most of options from [Swagger UI](https://swagger.io/docs/open-source-tools/swagger-ui/usage/configuration/) are supported as well.

such as:

- `url` (string, optional): The URL pointing to the OpenAPI definition (v2 or v3) that describes the API.
- `urls` (array, optional): An array of OpenAPI definitions (v2 or v3) that describe the APIs. Each definition must have a `name` and `url`.
- `presets` (array, optional): An array of presets to use for Swagger UI.
- `plugins` (array, optional): An array of plugins to use for Swagger UI.

## Authors

- naporitan <https://github.com/naporin0624>
- sor4chi <https://github.com/sor4chi>

## License

MIT
