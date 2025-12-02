# Standard Schema validator middleware for Hono

[![codecov](https://codecov.io/github/honojs/middleware/graph/badge.svg?flag=standard-validator)](https://codecov.io/github/honojs/middleware)

The validator middleware using [Standard Schema Spec](https://github.com/standard-schema/standard-schema) for [Hono](https://honojs.dev) applications.
You can write a schema with any validation library supporting Standard Schema and validate the incoming values.

## Usage

### Basic:

```ts
import { z } from 'zod'
import { sValidator } from '@hono/standard-validator'

const schema = z.object({
  name: z.string(),
  age: z.number(),
})

app.post('/author', sValidator('json', schema), (c) => {
  const data = c.req.valid('json')
  return c.json({
    success: true,
    message: `${data.name} is ${data.age}`,
  })
})
```

### Hook:

```ts
app.post(
  '/post',
  sValidator('json', schema, (result, c) => {
    if (!result.success) {
      return c.text('Invalid!', 400)
    }
  })
  //...
)
```

### Headers:

Headers are internally transformed to lower-case in Hono. Hence, you will have to make them lower-cased in validation object.

```ts
import { object, string } from 'valibot'
import { sValidator } from '@hono/standard-validator'

const schema = object({
  'content-type': string(),
  'user-agent': string(),
})

app.post('/author', sValidator('header', schema), (c) => {
  const headers = c.req.valid('header')
  // do something with headers
})
```

## Author

Rokas Muningis <https://github.com/muningis>

## License

MIT
