import type { Readable, Writable } from 'svelte/store';

export function isWritable<T>(value: Readable<T>): value is Writable<T> {
	return typeof (value as Writable<T>).set === 'function';
}

export function isReadable<T>(value: any): value is Readable<T> {
	return typeof (value as Readable<T>).subscribe === 'function';
}
