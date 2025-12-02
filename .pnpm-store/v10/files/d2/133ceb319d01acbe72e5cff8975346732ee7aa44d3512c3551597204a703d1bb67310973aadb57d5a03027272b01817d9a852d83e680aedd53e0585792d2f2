import type { Entries } from "../vendor/type-fest/entries";

export function typedEntries<T extends { [s: string]: T[keyof T] } | ArrayLike<T[keyof T]>>(obj: T): Entries<T> {
	return Object.entries(obj) as Entries<T>;
}
