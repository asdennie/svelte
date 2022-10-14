import { writable, type Updater, type Writable } from 'svelte/store';

export interface StorageOptions<T> {
	key: string;
	parse?: (value: string) => T;
	stringify?: (value?: T) => string;
	defaultValue?: T;
	storage?: Storage;
}
export function storageValue<T>({
	key,
	defaultValue,
	stringify = JSON.stringify,
	parse = JSON.parse,
	storage = localStorage
}: StorageOptions<T>): Writable<T> {
	const initial = stringify(defaultValue);

	const getter = () => {
		const value = storage?.getItem(key);
		if (typeof value !== 'string') return defaultValue;
		try {
			return parse(value);
		} catch (e) {
			return defaultValue;
		}
	};
	const setter = (value: T) => {
		const stringified = stringify(value);
		if (stringified === initial) {
			storage?.removeItem(key);
		} else {
			storage?.setItem(key, stringified);
		}
		return value;
	};

	const store = writable<T>(getter());
	const update = (fn: Updater<T>) => store.update((prev) => setter(fn(prev)));
	const set = (value: T) => update(() => value);
	return {
		...store,
		update,
		set
	};
}
