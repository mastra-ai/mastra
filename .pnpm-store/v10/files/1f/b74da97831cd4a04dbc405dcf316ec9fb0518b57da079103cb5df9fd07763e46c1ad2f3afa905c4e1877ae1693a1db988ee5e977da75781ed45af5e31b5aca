# react-docgen-typescript

[![Build Status](https://github.com/styleguidist/react-docgen-typescript/actions/workflows/nodejs.yml/badge.svg)](https://github.com/styleguidist/react-docgen-typescript/actions/workflows/nodejs.yml)

![](https://nodei.co/npm/react-docgen-typescript.png?downloadRank=true&downloads=true)

A simple parser for React properties defined in TypeScript instead of propTypes.

It can be used with [React Styleguidist](https://github.com/styleguidist/react-styleguidist).

## Installation

```bash
npm install --save-dev react-docgen-typescript
```

## Usage

To parse a file for docgen information use the `parse` function.

```ts
const docgen = require("react-docgen-typescript");

const options = {
  savePropValueAsString: true,
};

// Parse a file for docgen info
docgen.parse("./path/to/component", options);
```

If you want to customize the typescript configuration or docgen options, this package exports a variety of ways to create custom parsers.

```ts
const docgen = require("react-docgen-typescript");

// Create a parser with the default typescript config and custom docgen options
const customParser = docgen.withDefaultConfig(options);

const docs = customParser.parse("./path/to/component");

// Create a parser with the custom typescript and custom docgen options
const customCompilerOptionsParser = docgen.withCompilerOptions(
  { esModuleInterop: true },
  options
);

// Create a parser with using your typescript config
const tsConfigParser = docgen.withCustomConfig("./tsconfig.json", {
  savePropValueAsString: true,
});
```

### React Styleguidist integration

Include following line in your `styleguide.config.js`:

```javascript
module.exports = {
  propsParser: require("react-docgen-typescript").withDefaultConfig([
    parserOptions,
  ]).parse,
};
```

or if you want to use custom tsconfig file

```javascript
module.exports = {
  propsParser: require("react-docgen-typescript").withCustomConfig(
    "./tsconfig.json",
    [parserOptions]
  ).parse,
};
```

## Options

### `propFilter`

The `propFilter` option allows you to omit certain props from documentation generation.

You can either provide and object with some of our pre-configured filters:

```typescript
interface FilterOptions {
  skipPropsWithName?: string[] | string;
  skipPropsWithoutDoc?: boolean;
}

const options = {
  propFilter: {
    skipPropsWithName: ['as', 'id'];
    skipPropsWithoutDoc: true;
  }
}
```

If you do not want to print out all the HTML attributes of a component typed like the following:

```typescript
const MyComponent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ()...
```

you can provide a `propFilter` function and do the filtering logic yourself.

```typescript
type PropFilter = (prop: PropItem, component: Component) => boolean;

const options = {
  propFilter: (prop: PropItem, component: Component) => {
    if (prop.declarations !== undefined && prop.declarations.length > 0) {
      const hasPropAdditionalDescription = prop.declarations.find((declaration) => {
        return !declaration.fileName.includes("node_modules");
      });

      return Boolean(hasPropAdditionalDescription);
    }

    return true;
  },
};
```

Note: `children` without a doc comment will not be documented.

### `componentNameResolver`

```typescript
(exp: ts.Symbol, source: ts.SourceFile) => string | undefined | null | false;
```

If a string is returned, then the component will use that name. Else it will fallback to the default logic of parser.

### `shouldExtractLiteralValuesFromEnum`: boolean

If set to true, string enums and unions will be converted to docgen enum format. Useful if you use Storybook and want to generate knobs automatically using [addon-smart-knobs](https://github.com/storybookjs/addon-smart-knobs).

### `shouldExtractValuesFromUnion`: boolean

If set to true, every unions will be converted to docgen enum format.

### `shouldSortUnions`: boolean

When used in combination with `shouldExtractValuesFromUnion` or `shouldExtractLiteralValuesFromEnum`, sorts union members in string-sort order when set to true. This is useful for ensuring the same order of members every time.

### `skipChildrenPropWithoutDoc`: boolean (default: `true`)

If set to false the docs for the `children` prop will be generated even without an explicit description.

### `shouldRemoveUndefinedFromOptional`: boolean

If set to true, types that are optional will not display " | undefined" in the type.

### `savePropValueAsString`: boolean

If set to true, defaultValue to props will be string.
Example:

```javascript
Component.defaultProps = {
  counter: 123,
  disabled: false,
};
```

Will return:

```javascript
  counter: {
      defaultValue: '123',
      required: true,
      type: 'number'
  },
  disabled: {
      defaultValue: 'false',
      required: true,
      type: 'boolean'
  }
```

**Styled components example:**

```typescript
componentNameResolver: (exp, source) =>
  exp.getName() === "StyledComponentClass" && getDefaultExportForFile(source);
```

> The parser exports `getDefaultExportForFile` helper through its public API.

## Example

In the example folder you can see React Styleguidist integration.

**Warning:** only named exports are supported. If your project uses default exports, you still need to include named exports for `react-docgen-typescript`.

The component [`Column.tsx`](./examples/react-styleguidist-example/components/Column.tsx)

```javascript
import * as React from "react";
import { Component } from "react";

/**
 * Column properties.
 */
export interface IColumnProps {
  /** prop1 description */
  prop1?: string;
  /** prop2 description */
  prop2: number;
  /**
   * prop3 description
   */
  prop3: () => void;
  /** prop4 description */
  prop4: "option1" | "option2" | "option3";
}

/**
 * Form column.
 */
export class Column extends Component<IColumnProps, {}> {
  render() {
    return <div>Test</div>;
  }
}
```

Will generate the following stylesheet:

![Stylesheet example](https://github.com/styleguidist/react-docgen-typescript/raw/master/stylesheet-example-column.png "Stylesheet example")

The functional component [`Grid.tsx`](./examples/react-styleguidist-example/components/Grid.tsx)

```javascript
import * as React from "react";

/**
 * Grid properties.
 */
export interface IGridProps {
  /** prop1 description */
  prop1?: string;
  /** prop2 description */
  prop2: number;
  /**
   * prop3 description
   */
  prop3: () => void;
  /** Working grid description */
  prop4: "option1" | "option2" | "option3";
}

/**
 * Form Grid.
 */
export const Grid = (props: IGridProps) => {
  const smaller = () => {
    return;
  };
  return <div>Grid</div>;
};
```

Will generate the following stylesheet:

![Stylesheet example](https://github.com/styleguidist/react-docgen-typescript/raw/master/stylesheet-example-grid.png "Stylesheet example")

## Contributions

The typescript is pretty complex and there are many different ways how
to define components and their props so it's realy hard to support all
these use cases. That means only one thing, contributions are highly
welcome. Just keep in mind that each PR should also include tests for
the part it's fixing.

Thanks to all contributors without their help there wouldn't be a single
bug fixed or feature implemented. Check the [**contributors**](https://github.com/styleguidist/react-docgen-typescript/graphs/contributors) tab to find out
more. All those people supported this project. **THANK YOU!**

## Thanks to others

The integration with React Styleguidist wouldn't be possible without [Vyacheslav Slinko](https://github.com/vslinko) pull request [#118](https://github.com/styleguidist/react-styleguidist/pull/118) at React Styleguidist.
