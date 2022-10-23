export type Path = [string | number, number, number];
const CHAR_ARRAY_OPEN = '[';
const CHAR_ARRAY_CLOSE = ']';
const CHAR_DOT = '.';

export function parsePath(path: string) {
	const paths: Path[] = [];
	let start = 0;
	for (let i = 0; i < path.length; i++) {
		switch (path[i]) {
			case CHAR_ARRAY_OPEN:
			case CHAR_ARRAY_CLOSE:
			case CHAR_DOT:
				if (i !== start) {
					const sub_key = path.substring(start, i);
					paths.push([path[i] === CHAR_ARRAY_CLOSE ? parseInt(sub_key) : sub_key, start, i]);
				}
				start = i + 1;
				break;
		}
	}
	if (start !== path.length) {
		paths.push([path.substring(start, path.length), start, path.length]);
	}

	return paths;
}

export function isArrayPathIndex(path: string, paths: Path[], index: number) {
	if (index > paths.length - 1) return false;
	const [, start, end] = paths[index];
	return path[start - 1] === '[' && path[end] === ']';
}
export function isArrayPath(path: string, paths: Path[], index: number) {
	return (
		isArrayPathIndex(path, paths, index + 1) ||
		(index === 0 && isArrayPathIndex(path, paths, index))
	);
}
