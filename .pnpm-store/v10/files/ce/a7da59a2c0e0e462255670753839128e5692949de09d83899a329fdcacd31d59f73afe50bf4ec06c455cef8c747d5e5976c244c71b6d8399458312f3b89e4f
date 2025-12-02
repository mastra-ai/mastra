# Error Causes

Simple error handling based on standard JavaScript error cause.

Handling errors should be easier. Imagine if you could do this:

```js
const [fetchErrors, handleFetchErrors] = errorCauses({
  NotFound: {
    code: 404,
    message: "The requested resource was not found",
  },
  MissingURI: {
    code: 400,
    message: "URI is required",
  },
});

fetch(uri).then(handleSuccess).catch(handleFetchErrors({
  NotFound: ({ name, code, message }) =>
    // 404 NotFound: The requested resource was not found
    console.log(`${ code } ${ name }: ${ message }`),
  MissingURI: ({ message }) => console.log(message), // URI is required
}));
```

With Error Causes, you can. When you build an API or SDK, you can define the errors that can occur and export both the possible error causes, and a function to handle them that users can pass their own handlers to. It's a nice way to document your API with live code and make it easy for users to handle errors.

Error Causes also makes it easy to throw errors with a named cause:

```js
const { NotFound, MissingURI } = fetchErrors;

if (!uri) throw createError(MissingURI);
```

## Getting Started

Install with npm:

```js
npm install error-causes
```

Or install with yarn:

```
yarn add error-causes
```

Import:

```js
import { errorCauses, createError, noop } from "error-causes";
```


## Why Error Causes?

For every asynchronous API, it's a good idea to define and document the various error causes that might arise. How can a caller distinguish an error caused by bad input from an error caused by a network failure?

One common solution in JavaScript is to use custom error types and the `instanceof` operator to distinguish between different error causes in calling code. That is a bad idea because JavaScript uses isolated memory realms for security, and `instanceof` always fails across memory realms (e.g., it will always fail when testing an instance in a child iframe against a constructor in the parent frame, or vice versa). It's also a bad idea because errors can be serialized, deserialized, and rethrown, which could break the `instanceof` lookup. In other words, the `instanceof` approach works most of the time, but when it doesn't it can cause a lot of wasted debugging time.

Another common solution is to branch based on the text of the error message. That's a bad idea because error messages are likely to change, and may even be localized, making them an inapropriate basis for conditional branching.

Traditionally in both hardware and software engineering, conditional branching for error handling is done using error codes instead of types. For example, the ubiquitous [HTTP status codes](https://en.wikipedia.org/wiki/List_of_HTTP_status_codes).

Unfortunately, JavaScript never standardized the inclusion of an error code. Adding your own involves subclassing or extending the error object in non-standard ways, and there was never a way to pass a cause or structured metadata to the Error constructor - only a message. Until ECMAScript 2022 added the [error cause](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause#providing_structured_data_as_the_error_cause) parameter to the `Error` constructor.

That helps a little, but handlers still have to manually destructure causes.

Under the hood, `error-causes` constructs a structured `cause` property for thrown errors that it can then use to automatically match in the error handler:

```js
type Cause = {
  name: String,
  message: String
  code: Any,
  stack: String,
  cause: Cause, // You can use this to reference the original error
}
```

## API

### errorCauses

```js
(options: ErrorCausesOptions) => [
  ErrorCausesOptions,
  handleErrors(CausedError) => Void
]
```

Takes options and returns an object containing error causes keyed by error name, and an error handling function.

The returned cause objects can be passed to the `createError` factory to create the corresponding `CausedError`, or used to manually switch over an error if you prefer not to use the error matcher.

```js
// Can include any number of ErrorName: Cause pairs
type ErrorCausesOptions = {
  [ErrorName]: Cause // See above
}
```

#### handleErrors Throws

If you pass an error handlers object which is missing an error cause, it will throw an error. You must supply handlers for all error causes. This is to ensure that you don't accidentally forget to handle an error.

```js
const MissingHandler = {
  name: "MissingHandler",
  message: "Missing error handler",
};
```

`handleErrors` returns a function that takes an error and returns nothing. It will throw if the error is not a `CausedError` or if the error cause is not handled.

```js
const UnexpectedError = {
  name: "UnexpectedError",
  message: "An unexpected error was thrown",
};
```


### createError

```js
(errorOptions: ErrorOptions) => CausedError
```

In order to be handled by the automatically generated handler, errors must have a cause property. The built-in syntax to create a caused error looks like this:

```js
const notFoundError = new Error('The requested resource was not found', {
  cause: {
    name: 'NotFound',
    code: 404
  }
);
```

That's not too bad, but we think this is much nicer:

```js
const notFoundError = createError({
  name: 'NotFound',
  code: 404,
  message: 'The requested resource was not found,
});
```

Options:

```js
type errorOptions = {
  name: String,
  code: Any,
  message: String,
  cause: Any,
  stack: String,
  ...rest: * // Mixed types allowed
}
```

### noop

A no-op function which can be used as a default handler for errors that you don't care about.

```js
() => Void
```

## Sponsors

This project is made possible by [EricElliottJS.com](https://ericelliottjs.com) and [DevAnywhere.io](https://devanywhere.io). If you would like to sponsor this project, [reach out via DevAnywhere](https://devanywhere.io/help?subject=Sponsor+Error+Causes).


## License

MIT
