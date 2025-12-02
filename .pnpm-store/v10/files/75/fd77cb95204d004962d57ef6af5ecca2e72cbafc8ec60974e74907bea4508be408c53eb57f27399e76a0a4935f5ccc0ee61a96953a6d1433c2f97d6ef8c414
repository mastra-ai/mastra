import type {IsEmptyObject} from './empty-object.d.ts';
import type {If} from './if.d.ts';
import type {IsUnion} from './is-union.d.ts';

/**
Create a type that only accepts an object with a single key.

@example
```
import type {SingleKeyObject} from 'type-fest';

const someFunction = <T>(parameter: SingleKeyObject<T>) => {};

someFunction({
	value: true
});

someFunction({
	value: true,
	otherKey: true
});
// Error: Argument of type '{value: boolean; otherKey: boolean}' is not assignable to parameter of type 'never'.ts(2345)
```

@category Object
*/
export type SingleKeyObject<ObjectType> =
	IsUnion<keyof ObjectType> extends true
		? never
		: If<IsEmptyObject<ObjectType>, never, ObjectType>;

export {};
