import { isArrayPathIndex, parsePath } from './parsePath';
export function set<TData>(object: TData, path: string, valueToSet: unknown): TData {
	const paths = parsePath(path);
	const pathValues: unknown[] = [];
	let pathValue: unknown = object;
	for (let i = 0; i < paths.length; i++) {
		pathValues.push(pathValue);
		const [key] = paths[i];
		pathValue =
			typeof pathValue === 'object' && pathValue
				? pathValue[key as keyof typeof pathValue]
				: Array.isArray(pathValue)
				? pathValue[key as number]
				: undefined;
	}
	return pathValues.reverse().reduce((acc, prev, index) => {
		const pathIndex = paths.length - 1 - index;
		const [key] = paths[pathIndex];
		if (isArrayPathIndex(path, paths, pathIndex)) {
			if (Array.isArray(prev)) {
				if (prev[key as number] === acc) {
					// Unchanged value
					return prev;
				} else {
					const next = [...prev];
					next[key as number] = acc;
					return next;
				}
			} else {
				// Value is undefined or not an array
				const next = [];
				next[key as number] = acc;
				return next;
			}
		} else {
			if (typeof prev === 'object' && prev) {
				if (prev[key as keyof typeof prev] === acc) {
					return prev;
				} else {
					return {
						...prev,
						[key]: acc
					};
				}
			} else {
				return { [key]: acc };
			}
		}
	}, valueToSet) as TData;
}
