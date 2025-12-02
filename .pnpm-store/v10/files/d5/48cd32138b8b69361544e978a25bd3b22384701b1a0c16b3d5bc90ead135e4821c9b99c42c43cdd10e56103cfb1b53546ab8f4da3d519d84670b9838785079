import type {CamelCaseOptions, _DefaultCamelCaseOptions} from './camel-case.d.ts';
import type {ApplyDefaultOptions} from './internal/index.d.ts';
import type {PascalCase} from './pascal-case.d.ts';

/**
Convert object properties to pascal case recursively.

This can be useful when, for example, converting some API types from a different style.

@see {@link PascalCase}
@see {@link PascalCasedProperties}

@example
```
import type {PascalCasedPropertiesDeep} from 'type-fest';

interface User {
	userId: number;
	userName: string;
}

interface UserWithFriends {
	userInfo: User;
	userFriends: User[];
}

const result: PascalCasedPropertiesDeep<UserWithFriends> = {
	UserInfo: {
		UserId: 1,
		UserName: 'Tom',
	},
	UserFriends: [
		{
			UserId: 2,
			UserName: 'Jerry',
		},
		{
			UserId: 3,
			UserName: 'Spike',
		},
	],
};

const preserveConsecutiveUppercase: PascalCasedPropertiesDeep<{fooBAR: {fooBARBiz: [{fooBARBaz: string}]}}, {preserveConsecutiveUppercase: true}> = {
	FooBAR: {
		FooBARBiz: [{
			FooBARBaz: 'string',
		}],
	},
};
```

@category Change case
@category Template literal
@category Object
*/
export type PascalCasedPropertiesDeep<Value, Options extends CamelCaseOptions = {}> =
	_PascalCasedPropertiesDeep<Value, ApplyDefaultOptions<CamelCaseOptions, _DefaultCamelCaseOptions, Options>>;

type _PascalCasedPropertiesDeep<Value, Options extends Required<CamelCaseOptions>> = Value extends Function | Date | RegExp
	? Value
	: Value extends Array<infer U>
		? Array<_PascalCasedPropertiesDeep<U, Options>>
		: Value extends Set<infer U>
			? Set<_PascalCasedPropertiesDeep<U, Options>>
			: Value extends object
				? {
					[K in keyof Value as PascalCase<K, Options>]: _PascalCasedPropertiesDeep<Value[K], Options>;
				}
				: Value;

export {};
