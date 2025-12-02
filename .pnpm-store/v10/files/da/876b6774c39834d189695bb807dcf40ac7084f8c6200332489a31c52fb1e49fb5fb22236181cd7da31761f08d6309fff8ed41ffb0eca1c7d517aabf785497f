import { pick } from "./pick";
import { typedInclude } from "./typedInclude";

/**
 * Return copy of object, omitting blacklisted array of props
 */
export function omit<T extends Record<string, unknown>, K extends keyof T>(
	o: T,
	props: K[] | K
): Pick<T, Exclude<keyof T, K>> {
	const propsArr = Array.isArray(props) ? props : [props];
	const letsKeep = (Object.keys(o) as (keyof T)[]).filter((prop) => !typedInclude(propsArr, prop));
	return pick(o, letsKeep);
}
