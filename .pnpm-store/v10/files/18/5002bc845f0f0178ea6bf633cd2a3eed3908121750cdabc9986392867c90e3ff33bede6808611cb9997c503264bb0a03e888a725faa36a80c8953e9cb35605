# Extendable Error [![Build Status](https://travis-ci.org/vilic/extendable-error.svg)](https://travis-ci.org/vilic/extendable-error)

A simple abstract extendable error class that extends `Error`, which handles the error `name`, `message` and `stack` property.

## Install

```sh
npm install extendable-error --save
```

## Usage

```ts
import ExtendableError from 'extendable-error';

class SomeError extends ExtendableError {
  constructor(
    message: string,
    public code: number
  ) {
    super(message);
  }
}

let someError = new SomeError('Some error', 0x0001);
```

## License

MIT License.
