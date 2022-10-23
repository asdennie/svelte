<svelte:options immutable={true} />

<script lang="ts">
	import { set } from '$lib/form/set';
	import { parseInt, useForm } from '$lib/form/useForm';
	import { readable } from 'svelte/store';

	const inputs = {
		simple: {
			value: { a: { b: { c: [{ d: { e: 'Dennie' } }], c2: 'xxx' } } },
			changes: [
				['a.b.c[0].d.e', 'Dennie de Lange'],
				['a.c[2]', { name: 'Dennie de lange' }]
			]
		}
	};

	const result = Object.entries(inputs).reduce((acc, [key, { value, changes }]) => {
		acc[key] = {
			original: value,
			results: changes.map(([path, change]) => ({
				path,
				change,
				result: set(value, path as string, change)
			}))
		};
		return acc;
	}, {} as Record<string, any>);

	const { data, form, isSubmitting, submit, setValue, dirtyFields, isDirty } = useForm({
		fields: {
			agree: {
				parse: parseInt
			}
		},
		data: readable({ name: 'Dennie de Lange', agree: '4', age: 23 }),
		onSubmit: () => {}
	});

	let options = [
		{ value: '1', label: 'Yes' },
		{ value: '2', label: 'No' }
	];

	$: console.log('data: ', $data);
	setTimeout(() => (options = [...options, { value: '4', label: 'Ok' }]), 5 * 1000);
</script>

<form use:form style="display: flex;flex-direction: column; ">
	<input type="text" name="name" placeholder="name" />
	{#if $data.age != 32}
		<input type="text" name="lastname" placeholder="lastname" />
	{/if}
	<input type="number" name="age" placeholder="age" />
	<select name="agree" placeholder="Agree?">
		<option value="">Unknown</option>
		{#each options as { value, label }}
			<option {value}>{label}</option>
		{/each}
	</select>
	<select name="thickness" multiple placeholder="Agree?">
		<option value="">Unknown</option>
		<option value={10}>10</option>
		<option value="20">20</option>
		<option value="30">30</option>
		<option value="40">40</option>
	</select>

	<button type="submit">Submit</button>
</form>

<div>{JSON.stringify($data, null, 2)}</div>
