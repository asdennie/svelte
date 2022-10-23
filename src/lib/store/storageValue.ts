import { writable, type Updater, type Writable } from 'svelte/store';

export interface StorageOptions<T> {
	key: string;
	parse?: (value: string) => T;
	stringify?: (value?: T) => string;
	defaultValue?: T;
	storage?: (() => undefined | Storage) | Storage;
}
export function storageValue<T>({
	key,
	defaultValue,
	stringify = JSON.stringify,
	parse = JSON.parse,
	storage
}: StorageOptions<T>): Writable<T> {
	const initial = stringify(defaultValue);

	const finalStorage = typeof storage === 'function' ? storage() : storage;

	const getter = () => {
		const value = finalStorage?.getItem(key);
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
			finalStorage?.removeItem(key);
		} else {
			finalStorage?.setItem(key, stringified);
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
