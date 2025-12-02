<div>
	<h1 align="center"><a href="https://npm.im/@epic-web/invariant">💥 @epic-web/invariant</a></h1>
	<strong>
		Throw errors when thing's aren't right.
	</strong>
	<p>
		Type safe utilities for throwing errors (and responses) in exceptional
		situations in a declarative way.
	</p>
</div>

```
npm install @epic-web/invariant
```

<div align="center">
	<a
		alt="Epic Web logo"
		href="https://www.epicweb.dev"
	>
		<img
			width="300px"
			src="https://github-production-user-asset-6210df.s3.amazonaws.com/1500684/257881576-fd66040b-679f-4f25-b0d0-ab886a14909a.png"
		/>
	</a>
</div>

<hr />

<!-- prettier-ignore-start -->
[![Build Status][build-badge]][build]
[![MIT License][license-badge]][license]
[![Code of Conduct][coc-badge]][coc]
<!-- prettier-ignore-end -->

## The Problem

Your application has boundaries. Network requests/responses, file system reads,
etc. When you're working with these boundaries, you need to be able to handle
errors that may occur, even in TypeScript.

TypeScript will typically make these boundaries much more obvious because it
doesn't like not knowing what the type of something is. For example:

```ts
const formData = new FormData(formElement)
const name = await formData.get('name')
// name is `File | string | null`
```

Often it's a good idea to use a proper parsing library for situations like this,
but for simple cases that can often feel like overkill. But you don't want to
just ignore TypeScript because:

> TypeScript is that brutally honest friend you put up with because they save
> you from making terrible mistakes. –
> [@kentcdodds](https://twitter.com/kentcdodds/status/1715562350835855396)

So you check it:

```ts
const formData = new FormData(formElement)
const name = await formData.get('name')
// name is `File | string | null`
if (typeof name !== 'string') {
	throw new Error('Name must be a string')
}
// now name is `string` (and TypeScript knows it too)
```

You're fine throwing a descriptive error here because it's just _very_ unlikely
this will ever happen and even if it does you wouldn't really know what to do
about it anyway.

It's not a big deal, but there's a tiny bit of boilerplate that would be nice to
avoid. Especially when you find yourself doing this all over the codebase. This
is the problem `@epic-web/invariant` solves.

## The Solution

Here's the diff from what we had above:

```diff
const formData = new FormData(formElement)
const name = await formData.get('name')
// name is `File | string | null`
- if (typeof name !== 'string') {
- 	throw new Error('Name must be a string')
- }
+ invariant(typeof name === 'string', 'Name must be a string')
// now name is `string` (and TypeScript knows it too)
```

It's pretty simple. But honestly, it's nicer to read, it throws a special
`InvariantError` object to distinguish it from other types of errors, and we
have another useful utility for throwing `Response` objects instead of `Error`
objects which is handy
[in Remix](https://remix.run/docs/en/main/route/loader#throwing-responses-in-loaders).

## Usage

### `invariant`

The `invariant` function is used to assert that a condition is true. If the
condition is false, it throws an error with the provided message.

**Basic Usage**

```ts
import { invariant } from '@epic-web/invariant'

const creature = { name: 'Dragon', type: 'Fire' }
invariant(creature.name === 'Dragon', 'Creature must be a Dragon')
```

**Throwing a Response on False Condition**

```ts
import { invariant } from '@epic-web/invariant'

const creature = { name: 'Unicorn', type: 'Magic' }
invariant(creature.type === 'Fire', 'Creature must be of type Fire')
// Throws: InvariantError: Creature must be of type Fire
```

**Using Callback for Error Message**

```ts
import { invariantResponse } from '@epic-web/invariant'

const creature = { name: 'Elf', type: 'Forest' }
invariant(creature.type === 'Water', () => 'Creature must be of type Water')
// Throws: InvariantError: Creature must be of type Water
```

### `invariantResponse`

The `invariantResponse` function works similarly to `invariant`, but instead of
throwing an `InvariantError`, it throws a Response object.

**Basic Usage**

```ts
import { invariantResponse } from '@epic-web/invariant'

const creature = { name: 'Phoenix', type: 'Fire' }
invariantResponse(creature.type === 'Fire', 'Creature must be of type Fire')
```

**Throwing a Response on False Condition**

```ts
import { invariantResponse } from '@epic-web/invariant'

const creature = { name: 'Griffin', type: 'Air' }
invariantResponse(creature.type === 'Water', 'Creature must be of type Water')
// Throws: Response { status: 400, body: 'Creature must be of type Water' }
```

The response status default if 400 (Bad Request), but you'll find how to change
that below.

**Using Callback for Response Message**

```ts
import { invariantResponse } from '@epic-web/invariant'

const creature = { name: 'Mermaid', type: 'Water' }
invariantResponse(
	creature.type === 'Land',
	() => `Expected a Land creature, but got a ${creature.type} creature`,
)
```

**Throwing a Response with Additional Options**

```ts
import { invariantResponse } from '@epic-web/invariant'

const creature = { name: 'Cerberus', type: 'Underworld' }
invariantResponse(
	creature.type === 'Sky',
	JSON.stringify({ error: 'Creature must be of type Sky' }),
	{ status: 500, headers: { 'Content-Type': 'text/json' } },
)
```

## Differences from [invariant](https://www.npmjs.com/package/invariant)

There are three main differences. With `@epic-web/invariant`:

1. Error messages are the same in dev and prod
2. It's typesafe
3. We support the common case (for Remix anyway) of throwing Responses as well
   with `invariantResponse`.

## License

MIT

<!-- prettier-ignore-start -->
[build-badge]: https://img.shields.io/github/actions/workflow/status/epicweb-dev/invariant/release.yml?branch=main&logo=github&style=flat-square
[build]: https://github.com/epicweb-dev/invariant/actions?query=workflow%3Arelease
[license-badge]: https://img.shields.io/badge/license-MIT%20License-blue.svg?style=flat-square
[license]: https://github.com/epicweb-dev/invariant/blob/main/LICENSE
[coc-badge]: https://img.shields.io/badge/code%20of-conduct-ff69b4.svg?style=flat-square
[coc]: https://kentcdodds.com/conduct
<!-- prettier-ignore-end -->
