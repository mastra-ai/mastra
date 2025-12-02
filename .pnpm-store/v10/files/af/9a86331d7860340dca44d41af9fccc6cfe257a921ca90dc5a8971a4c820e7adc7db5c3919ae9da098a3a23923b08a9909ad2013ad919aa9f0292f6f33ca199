import { ComponentType } from 'react';
import { PreviewAddon, InferTypes, AddonTypes, Preview, Meta, Story } from 'storybook/internal/csf';
import { ProjectAnnotations, Args, DecoratorFunction, ArgsStoryFn, ComponentAnnotations, Renderer, StoryAnnotations } from 'storybook/internal/types';
import { c as Simplify, A as AddMocks, d as SetOptional } from './public-types-d899d203.js';
import { a as ReactTypes } from './types-7abe74eb.js';
import 'react-dom/client';

/**
Remove any index signatures from the given object type, so that only explicitly defined properties remain.

Use-cases:
- Remove overly permissive signatures from third-party types.

This type was taken from this [StackOverflow answer](https://stackoverflow.com/a/68261113/420747).

It relies on the fact that an empty object (`{}`) is assignable to an object with just an index signature, like `Record<string, unknown>`, but not to an object with explicitly defined keys, like `Record<'foo' | 'bar', unknown>`.

(The actual value type, `unknown`, is irrelevant and could be any type. Only the key type matters.)

```
const indexed: Record<string, unknown> = {}; // Allowed

const keyed: Record<'foo', unknown> = {}; // Error
// => TS2739: Type '{}' is missing the following properties from type 'Record<"foo" | "bar", unknown>': foo, bar
```

Instead of causing a type error like the above, you can also use a [conditional type](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html) to test whether a type is assignable to another:

```
type Indexed = {} extends Record<string, unknown>
	? '✅ `{}` is assignable to `Record<string, unknown>`'
	: '❌ `{}` is NOT assignable to `Record<string, unknown>`';
// => '✅ `{}` is assignable to `Record<string, unknown>`'

type Keyed = {} extends Record<'foo' | 'bar', unknown>
	? "✅ `{}` is assignable to `Record<'foo' | 'bar', unknown>`"
	: "❌ `{}` is NOT assignable to `Record<'foo' | 'bar', unknown>`";
// => "❌ `{}` is NOT assignable to `Record<'foo' | 'bar', unknown>`"
```

Using a [mapped type](https://www.typescriptlang.org/docs/handbook/2/mapped-types.html#further-exploration), you can then check for each `KeyType` of `ObjectType`...

```
import type {RemoveIndexSignature} from 'type-fest';

type RemoveIndexSignature<ObjectType> = {
	[KeyType in keyof ObjectType // Map each key of `ObjectType`...
	]: ObjectType[KeyType]; // ...to its original value, i.e. `RemoveIndexSignature<Foo> == Foo`.
};
```

...whether an empty object (`{}`) would be assignable to an object with that `KeyType` (`Record<KeyType, unknown>`)...

```
import type {RemoveIndexSignature} from 'type-fest';

type RemoveIndexSignature<ObjectType> = {
	[KeyType in keyof ObjectType
		// Is `{}` assignable to `Record<KeyType, unknown>`?
		as {} extends Record<KeyType, unknown>
			? ... // ✅ `{}` is assignable to `Record<KeyType, unknown>`
			: ... // ❌ `{}` is NOT assignable to `Record<KeyType, unknown>`
	]: ObjectType[KeyType];
};
```

If `{}` is assignable, it means that `KeyType` is an index signature and we want to remove it. If it is not assignable, `KeyType` is a "real" key and we want to keep it.

```
import type {RemoveIndexSignature} from 'type-fest';

type RemoveIndexSignature<ObjectType> = {
	[KeyType in keyof ObjectType
		as {} extends Record<KeyType, unknown>
			? never // => Remove this `KeyType`.
			: KeyType // => Keep this `KeyType` as it is.
	]: ObjectType[KeyType];
};
```

@example
```
import type {RemoveIndexSignature} from 'type-fest';

interface Example {
	// These index signatures will be removed.
	[x: string]: any
	[x: number]: any
	[x: symbol]: any
	[x: `head-${string}`]: string
	[x: `${string}-tail`]: string
	[x: `head-${string}-tail`]: string
	[x: `${bigint}`]: string
	[x: `embedded-${number}`]: string

	// These explicitly defined keys will remain.
	foo: 'bar';
	qux?: 'baz';
}

type ExampleWithoutIndexSignatures = RemoveIndexSignature<Example>;
// => { foo: 'bar'; qux?: 'baz' | undefined; }
```

@category Object
*/
type RemoveIndexSignature<ObjectType> = {
	[KeyType in keyof ObjectType as {} extends Record<KeyType, unknown>
		? never
		: KeyType]: ObjectType[KeyType];
};

/**
Convert a union type to an intersection type using [distributive conditional types](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-8.html#distributive-conditional-types).

Inspired by [this Stack Overflow answer](https://stackoverflow.com/a/50375286/2172153).

@example
```
import type {UnionToIntersection} from 'type-fest';

type Union = {the(): void} | {great(arg: string): void} | {escape: boolean};

type Intersection = UnionToIntersection<Union>;
//=> {the(): void; great(arg: string): void; escape: boolean};
```

A more applicable example which could make its way into your library code follows.

@example
```
import type {UnionToIntersection} from 'type-fest';

class CommandOne {
	commands: {
		a1: () => undefined,
		b1: () => undefined,
	}
}

class CommandTwo {
	commands: {
		a2: (argA: string) => undefined,
		b2: (argB: string) => undefined,
	}
}

const union = [new CommandOne(), new CommandTwo()].map(instance => instance.commands);
type Union = typeof union;
//=> {a1(): void; b1(): void} | {a2(argA: string): void; b2(argB: string): void}

type Intersection = UnionToIntersection<Union>;
//=> {a1(): void; b1(): void; a2(argA: string): void; b2(argB: string): void}
```

@category Type
*/
type UnionToIntersection<Union> = (
	// `extends unknown` is always going to be the case and is used to convert the
	// `Union` into a [distributive conditional
	// type](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-8.html#distributive-conditional-types).
	Union extends unknown
		// The union type is used as the only argument to a function since the union
		// of function arguments is an intersection.
		? (distributedUnion: Union) => void
		// This won't happen.
		: never
		// Infer the `Intersection` type since TypeScript represents the positional
		// arguments of unions of functions as an intersection of the union.
	) extends ((mergedIntersection: infer Intersection) => void)
		? Intersection
		: never;

declare function __definePreview<Addons extends PreviewAddon<never>[]>(input: {
    addons: Addons;
} & ProjectAnnotations<ReactTypes & InferTypes<Addons>>): ReactPreview<ReactTypes & InferTypes<Addons>>;
/** @ts-expect-error We cannot implement the meta faithfully here, but that is okay. */
interface ReactPreview<T extends AddonTypes> extends Preview<ReactTypes & T> {
    meta<TArgs extends Args, Decorators extends DecoratorFunction<ReactTypes & T, any>, TMetaArgs extends Partial<TArgs>>(meta: {
        render?: ArgsStoryFn<ReactTypes & T, TArgs>;
        component?: ComponentType<TArgs>;
        decorators?: Decorators | Decorators[];
        args?: TMetaArgs;
    } & Omit<ComponentAnnotations<ReactTypes & T, TArgs>, 'decorators' | 'component' | 'args' | 'render'>): ReactMeta<ReactTypes & T & {
        args: Simplify<TArgs & Simplify<RemoveIndexSignature<DecoratorsArgs<ReactTypes & T, Decorators>>>>;
    }, {
        args: Partial<TArgs> extends TMetaArgs ? {} : TMetaArgs;
    }>;
}
type DecoratorsArgs<TRenderer extends Renderer, Decorators> = UnionToIntersection<Decorators extends DecoratorFunction<TRenderer, infer TArgs> ? TArgs : unknown>;
interface ReactMeta<T extends ReactTypes, MetaInput extends ComponentAnnotations<T>>
/** @ts-expect-error hard */
 extends Meta<T, MetaInput> {
    story<TInput extends (() => ReactTypes['storyResult']) | (StoryAnnotations<T, T['args']> & {
        render: () => ReactTypes['storyResult'];
    })>(story?: TInput): ReactStory<T, TInput extends () => ReactTypes['storyResult'] ? {
        render: TInput;
    } : TInput>;
    story<TInput extends Simplify<StoryAnnotations<T, AddMocks<T['args'], MetaInput['args']>, SetOptional<T['args'], keyof T['args'] & keyof MetaInput['args']>>>>(story?: TInput
    /** @ts-expect-error hard */
    ): ReactStory<T, TInput>;
}
interface ReactStory<T extends ReactTypes, TInput extends StoryAnnotations<T, T['args']>> extends Story<T, TInput> {
    Component: ComponentType<Partial<T['args']>>;
}

export { ReactPreview, ReactStory, __definePreview };
