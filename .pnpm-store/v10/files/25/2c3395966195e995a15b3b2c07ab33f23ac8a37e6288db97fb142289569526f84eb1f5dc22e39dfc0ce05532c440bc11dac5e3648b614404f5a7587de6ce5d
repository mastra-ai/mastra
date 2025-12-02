# Better Call

Better call is a tiny web framework for creating endpoints that can be invoked as a normal function or mounted to a router to be served by any web standard compatible server (like Bun, node, nextjs, sveltekit...) and also includes a typed RPC client for typesafe client-side invocation of these endpoints.

Built for typescript and it comes with a very high performance router based on [rou3](https://github.com/unjs/rou3).

## Install

```bash
pnpm i better-call
```

Make sure to install [standard schema](https://github.com/standard-schema/standard-schema) compatible validation library like zod.

```bash
pnpm i zod
```

## Usage

The building blocks for better-call are endpoints. You can create an endpoint by calling `createEndpoint` and passing it a path, [options](#endpointoptions) and a handler that will be invoked when the endpoint is called.

```ts
import { createEndpoint, createRouter } from "better-call"
import { z } from "zod"

const createItem = createEndpoint("/item", {
    method: "POST",
    body: z.object({
        id: z.string()
    })
}, async (ctx) => {
    return {
        item: {
            id: ctx.body.id
        }
    }
})

// Now you can call the endpoint just as a normal function.
const item = await createItem({
    body: {
        id: "123"
    }
})
```

OR you can mount the endpoint to a router and serve it with any web standard compatible server. 

> The example below uses [Bun](https://bun.sh/)

```ts
const router = createRouter({
    createItem
})

Bun.serve({
    fetch: router.handler
})
```

Then you can use the rpc client to call the endpoints on client.

```ts
//client.ts
import type { router } from "./router" // import router type
import { createClient } from "better-call/client";

const client = createClient<typeof router>({
    baseURL: "http://localhost:3000"
});
const items = await client("/item", {
    body: {
        id: "123"
    }
});
```

### Returning non 200 responses

There are several supported ways to a non 200 response:

You can use the `ctx.setStatus(status)` helper to change the default status code of a successful response:

```ts
const createItem = createEndpoint("/item", {
    method: "POST",
    body: z.object({
        id: z.string()
    })
}, async (ctx) => {
    ctx.setStatus(201);
    return {
        item: {
            id: ctx.body.id
        }
    }
})
```

Sometimes, you want to respond with an error, in those cases you will need to throw Better Call's `APIError` error. If the endpoint is called as a function, the error will be thrown but if it's mounted to a router, the error will be converted to a response object with the correct status code and headers.

```ts
const createItem = createEndpoint("/item", {
    method: "POST",
    body: z.object({
        id: z.string()
    })
}, async (ctx) => {
    if(ctx.body.id === "123") {
        throw ctx.error("Bad Request", {
            message: "Id is not allowed"
        })
    }
    return {
        item: {
            id: ctx.body.id
        }
    }
})
```

You can also instead throw using a status code:

```ts
const createItem = createEndpoint("/item", {
    method: "POST",
    body: z.object({
        id: z.string()
    })
}, async (ctx) => {
    if(ctx.body.id === "123") {
        throw ctx.error(400, {
            message: "Id is not allowed"
        })
    }
    return {
        item: {
            id: ctx.body.id
        }
    }
})
```

Finally, you can return a new `Response` object. In this case, the `ctx.setStatus()` call will be ignored, as the `Response` will have completely control over the final status code:

```ts
const createItem = createEndpoint("/item", {
    method: "POST",
    body: z.object({
        id: z.string()
    })
}, async (ctx) => {
    return Response.json({
        item: {
            id: ctx.body.id
        }
    }, { status: 201 });
})
```

### Endpoint

Endpoints are building blocks of better-call. 

#### Path

The path is the URL path that the endpoint will respond to. It can be a direct path or a path with parameters and wildcards.

```ts
//direct path
const endpoint = createEndpoint("/item", {
    method: "GET",
}, async (ctx) => {})

//path with parameters
const endpoint = createEndpoint("/item/:id", {
    method: "GET",
}, async (ctx) => {
    return {
        item: {
            id: ctx.params.id
        }
    }
})

//path with wildcards
const endpoint = createEndpoint("/item/**:name", {
    method: "GET",  
}, async (ctx) => {
    //the name will be the remaining path
    ctx.params.name
})
```

#### Body Schema

The `body` option accepts a standard schema and will validate the request body. If the request body doesn't match the schema, the endpoint will throw an error. If it's mounted to a router, it'll return a 400 error.

```ts
const createItem = createEndpoint("/item", {
    method: "POST",
    body: z.object({
        id: z.string()
    })
}, async (ctx) => {
    return {
        item: {
            id: ctx.body.id
        }
    }
})
```

#### Query Schema

The `query` option accepts a standard schema and will validate the request query. If the request query doesn't match the schema, the endpoint will throw an error. If it's mounted to a router, it'll return a 400 error.

```ts
const createItem = createEndpoint("/item", {
    method: "GET",
    query: z.object({
        id: z.string()
    })
}, async (ctx) => {
    return {
        item: {
            id: ctx.query.id
        }
    }
})
```

#### Allowed Media Types

You can restrict which media types (MIME types) are allowed for request bodies using the `allowedMediaTypes` option. This can be configured at both the router level and the endpoint level, with endpoint-level configuration taking precedence.

When a request is made with a disallowed media type, the endpoint will return a `415 Unsupported Media Type` error.

**Router-level configuration:**

```ts
const router = createRouter({
    createItem,
    updateItem
}, {
    // All endpoints in this router will only accept JSON
    allowedMediaTypes: ["application/json"]
})
```

**Endpoint-level configuration:**

```ts
const uploadFile = createEndpoint("/upload", {
    method: "POST",
    metadata: {
        // This endpoint will only accept form data
        allowedMediaTypes: ["multipart/form-data"]
    }
}, async (ctx) => {
    return { success: true }
})
```

**Multiple media types:**

```ts
const createItem = createEndpoint("/item", {
    method: "POST",
    body: z.object({
        id: z.string()
    }),
    metadata: {
        // Accept both JSON and form-urlencoded
        allowedMediaTypes: [
            "application/json",
            "application/x-www-form-urlencoded"
        ]
    }
}, async (ctx) => {
    return {
        item: {
            id: ctx.body.id
        }
    }
})
```

**Endpoint overriding router:**

```ts
const router = createRouter({
    createItem,
    uploadFile
}, {
    // Default: only accept JSON
    allowedMediaTypes: ["application/json"]
})

const uploadFile = createEndpoint("/upload", {
    method: "POST",
    metadata: {
        // This endpoint overrides the router setting
        allowedMediaTypes: ["multipart/form-data", "application/octet-stream"]
    }
}, async (ctx) => {
    return { success: true }
})
```

Common media types:
- `application/json` - JSON data
- `application/x-www-form-urlencoded` - Form data
- `multipart/form-data` - File uploads
- `text/plain` - Plain text
- `application/octet-stream` - Binary data

> **Note:** The validation is case-insensitive and handles charset parameters automatically (e.g., `application/json; charset=utf-8` will match `application/json`).

#### Require Headers

The `requireHeaders` option is used to require the request to have headers. If the request doesn't have headers, the endpoint will throw an error. This is only useful when you call the endpoint as a function.

```ts
const createItem = createEndpoint("/item", {
    method: "GET",
    requireHeaders: true
}, async (ctx) => {
    return {
        item: {
            id: ctx.headers.get("id")
        }
    }
})
createItem({
    headers: new Headers()
})
```

#### Require Request

The `requireRequest` option is used to require the request to have a request object. If the request doesn't have a request object, the endpoint will throw an error. This is only useful when you call the endpoint as a function.

```ts
const createItem = createEndpoint("/item", {
    method: "GET",
    requireRequest: true
}, async (ctx) => {
    return {
        item: {
            id: ctx.request.id
        }
    }
})

createItem({
    request: new Request()
})
```

### Handler

this is the function that will be invoked when the endpoint is called. It accepts a context object that contains the request, headers, body, query, params and other information. 

It can return a response object, a string, a number, a boolean, an object or an array. 

It can also throw an error and if it throws APIError, it will be converted to a response object with the correct status code and headers.

- **Context**: the context object contains the request, headers, body, query, params and a helper function to set headers, cookies and get cookies. If there is a middleware, the context will be extended with the middleware context.

### Middleware

Endpoints can use middleware by passing the `use` option to the endpoint. To create a middleware, you can call `createMiddleware` and pass it a function or an options object and a handler function.

If you return a context object from the middleware, it will be available in the endpoint context.

```ts
import { createMiddleware, createEndpoint } from "better-call";

const middleware = createMiddleware(async (ctx) => {
    return {
        name: "hello"
    }
})

const endpoint = createEndpoint("/", {
    method: "GET",
    use: [middleware],
}, async (ctx) => {
   //this will be the context object returned by the middleware with the name property
   ctx.context
})
```

### Router

You can create a router by calling `createRouter` and passing it an array of endpoints. It returns a router object that has a `handler` method that can be used to serve the endpoints.

```ts
import { createRouter } from "better-call"
import { createItem } from "./item"

const router = createRouter({
    createItem
})

Bun.serve({
    fetch: router.handler
})
```

Behind the scenes, the router uses [rou3](https://github.com/unjs/rou3) to match the endpoints and invoke the correct endpoint. You can look at the [rou3 documentation](https://github.com/unjs/rou3) for more information.

#### Virtual endpoints

You can create virtual endpoints by completely omitting the `path`. Virtual endpoints do not get exposed for routing, do not generate OpenAPI docs and cannot be inferred through the [RPC client](#rpc-client), but they can still be invoked directly:

```ts
import { createEndpoint, createRouter } from "better-call";

const endpoint = createEndpoint({
    method: "GET",
}, async (ctx) => {
   return "ok";
})

const response = await endpoint(); // this works

const router = createRouter({ endpoint })

Bun.serve({
    fetch: router.handler // endpoint won't be routed through the router handler
});

```

#### Scoped endpoints

You can also create endpoints that are exposed for routing, but that cannot be inferred through the client by using the `metadata.scope` option:

- `rpc` - the endpoint is exposed to the router, can be invoked directly and is available to the [RPC client](#rpc-client)
- `server` - the endpoint is exposed to the router, can be invoked directly, but is not available to the client
- `http` - the endpoint is only exposed to the router

```ts
import { createEndpoint, createRouter } from "better-call";

const endpoint = createEndpoint("/item", {
    method: "GET",
    metadata: {
        scope: "server"
    },
}, async (ctx) => {
   return "ok";
})

const response = await endpoint(); // this works

const router = createRouter({
    endpoint
})

Bun.serve({
    fetch: router.handler // endpoint won't be routed through the router handler
})
```

#### Router Options

**routerMiddleware:**

A router middleware is similar to an endpoint middleware but it's applied to any path that matches the route. It's like any traditional middleware. You have to pass endpoints to the router middleware as an array.

```ts
const routeMiddleware = createEndpoint("/api/**", {
    method: "GET",
}, async (ctx) => {
    return {
        name: "hello"
    }
})
const router = createRouter({
    createItem
}, {
    routerMiddleware: [{
        path: "/api/**",
        middleware:routeMiddleware
    }]
})
```

**basePath**: The base path for the router. All paths will be relative to this path.

**onError**: The router will call this function if an error occurs in the middleware or the endpoint. This function receives the error as a parameter and can return different types of values:

- If it returns a `Response` object, the router will use it as the HTTP response.
- If it throws a new error, the router will handle it based on its type (if it's an `APIError`, it will be converted to a response; otherwise, it will be re-thrown).
- If it returns nothing (void), the router will proceed with default error handling (checking `throwError` setting).

```ts
const router = createRouter({
    /**
     * This error handler can be set as async function or not.
     */
    onError: async (error) => {
        // Log the error
        console.error("An error occurred:", error);
        
        // Return a custom response
        return new Response(JSON.stringify({ message: "Something went wrong" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
});
```

**throwError**: If true, the router will throw an error if an error occurs in the middleware or the endpoint. If false (default), the router will handle errors internally. This setting is still relevant even when `onError` is provided, as it determines the behavior when:

1. No `onError` handler is provided, or
2. The `onError` handler returns void (doesn't return a Response or throw an error)

- For `APIError` instances, it will convert them to appropriate HTTP responses.
- For other errors, it will return a 500 Internal Server Error response.

```ts
const router = createRouter({
    throwError: true, // Errors will be propagated to higher-level handlers
    onError: (error) => {
        // Log the error but let throwError handle it
        console.error("An error occurred:", error);
        // No return value, so throwError setting will determine behavior
    }
});
```

#### Node Adapter

You can use the node adapter to serve the router with node http server.

```ts
import { createRouter } from "better-call";
import { toNodeHandler } from "better-call/node";
import { createItem } from "./item";
import http from "http";

const router = createRouter({
    createItem
})
const server = http.createServer(toNodeHandler(router.handler))
```

### RPC Client

better-call comes with a rpc client that can be used to call endpoints from the client. The client wraps over better-fetch so you can pass any options that are supported by better-fetch.

```ts
import { createClient } from "better-call/client";
import { router } from "@serve/router";

const client = createClient<typeof router>({
    /**
     * if you add custom path like `http://
     * localhost:3000/api` make sure to add the 
     * custom path on the router config as well.
    */
    baseURL: "http://localhost:3000"
});
const items = await client("/item", {
    body: {
        id: "123"
    }
});
```
> You can also pass object that contains endpoints as a generic type to create client.

### Headers and Cookies

If you return a response object from an endpoint, the headers and cookies will be set on the response object. But You can  set headers and cookies for the context object.

```ts
const createItem = createEndpoint("/item", {
    method: "POST",
    body: z.object({
        id: z.string()
    })
}, async (ctx) => {
    ctx.setHeader("X-Custom-Header", "Hello World")
    ctx.setCookie("my-cookie", "hello world")
    return {
        item: {
            id: ctx.body.id
        }
    }
})
```
 
You can also get cookies from the context object.

```ts
const createItem = createEndpoint("/item", {
    method: "POST",
    body: z.object({
        id: z.string()
    })
}, async (ctx) => {
    const cookie = ctx.getCookie("my-cookie")
    return {
        item: {
            id: ctx.body.id
        }
    }
})
```

> other than normal cookies the ctx object also exposes signed cookies.

### Endpoint Creator

You can create an endpoint creator by calling `createEndpoint.create` that will let you apply set of middlewares to all the endpoints created by the creator.

```ts
const dbMiddleware = createMiddleware(async (ctx) => {
   return {
    db: new Database()
   }
})
const create = createEndpoint.create({
    use: [dbMiddleware]
})

const createItem = create("/item", {
    method: "POST",
    body: z.object({
        id: z.string()
    })
}, async (ctx) => {
    await ctx.context.db.save(ctx.body)
})
```

### Open API

Better Call by default generate open api schema for the endpoints and exposes it on `/api/reference` path using scalar. By default, if you're using `zod` it'll be able to generate `body` and `query` schema.

```ts
import { createEndpoint, createRouter } from "better-call"

const createItem = createEndpoint("/item/:id", {
    method: "GET",
    query: z.object({
        id: z.string({
            description: "The id of the item"
        })
    })
}, async (ctx) => {
    return {
        item: {
            id: ctx.query.id
        }
    }
})
```

But you can also define custom schema for the open api schema.

```ts
import { createEndpoint, createRouter } from "better-call"

const createItem = createEndpoint("/item/:id", {
    method: "GET",
    query: z.object({
        id: z.string({
            description: "The id of the item"
        })
    }),
    metadata: {
    openapi: {
        requestBody: {
            content: {
                "application/json": {
                    schema: {
                        type: "object",
                        properties: {
                            id: {
                                type: "string",
                                description: "The id of the item"
                            }
                        }
                    }
                }
            }
        }
    }
   }
}, async (ctx) => {
    return {
        item: {
            id: ctx.query.id
        }
    }
})
```

#### Configuration

You can configure the open api schema by passing the `openapi` option to the router.

```ts
const router = createRouter({
    createItem
}, {
    openapi: {
        disabled: false, //default false
        path: "/api/reference", //default /api/reference
        scalar: {
            title: "My API",
            version: "1.0.0",
            description: "My API Description",
            theme: "dark" //default saturn
        }
    }
})
```

## License
MIT