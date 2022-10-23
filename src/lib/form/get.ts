import { parsePath } from './parsePath';

export function get<TData, TDefault>(
	object: TData,
	path: string,
	defaultValue?: TDefault
): TDefault | undefined {
	const paths = parsePath(path);
	const result = paths.reduce((acc, [key]) => {
		return typeof acc === 'object' && acc
			? acc[key as keyof typeof acc]
			: Array.isArray(acc)
			? acc[key as number]
			: undefined;
	}, object) as unknown as TDefault;

	return result ?? defaultValue;
}
