import { readable, type Updater, type Writable } from 'svelte/store';

export function editValue<State, K extends keyof State>(
	store: Writable<State>,
	key: K,
	initial?: State[K]
): Writable<State[K]> {
	const { subscribe } = readable(initial, (set) =>
		store.subscribe((value) => {
			set(value[key]);
		})
	);
	const update = (updater: Updater<State[K]>) => {
		store.update((prev) => {
			const prev_value = prev[key];
			const next_Value = updater(prev_value);

			if (Array.isArray(prev) || Array.isArray(initial)) {
				if (Array.isArray(prev)) {
					const next = [...prev];
					next[key as number] = next_Value;
					return next as State;
				} else {
					return [next_Value] as State;
				}
			}
			return {
				...prev,
				[key]: next_Value
			};
		});
	};
	const set = (next: State[K]) => update(() => next);

	return {
		subscribe,
		update,
		set
	};
}
