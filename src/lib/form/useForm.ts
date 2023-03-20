import {
	derived,
	get as getStoreValue,
	writable,
	type Readable,
	type Unsubscriber
} from 'svelte/store';
import { findParent, isElement, isInputElement, isSelectElement } from './dom';
import FormSubmitError from './FormSubmitError';
import { get as defaultGet } from './get';
import { set as defaultSet } from './set';
import { triggerSelectors } from './triggerSelectors';
import type { FormErrors, TriggerSelector } from './types';

export interface UseFormOptions<FormValues> {
	data: Readable<FormValues>;
	stringify?: (value: any, name: string, values: FormValues) => string;
	parse?: (value: string, name: string, values: FormValues) => any;
	update?: (
		name: string,
		prev: FormValues,
		setter: (values: FormValues, path: string, value: any) => FormValues
	) => FormValues;
	get?: typeof defaultGet;
	logger?: (...values: any[]) => void;
	onSubmit: (values: FormValues) => Promise<void> | void;
	set?: typeof defaultSet;
	triggerSelector?: TriggerSelector;
	transform?: (value: unknown) => FormValues;
	validate?: (values: FormValues) => Readable<FormErrors>;
}
type FieldConfig<FormValues> = Required<
	Pick<UseFormOptions<FormValues>, 'stringify' | 'parse' | 'update'>
>;

export function useForm<FormValues>({
	data,
	get = defaultGet,
	parse = (x) => x,
	stringify = (x: unknown) => (x === undefined || x === null ? '' : String(x)),
	update = (_, values) => values,
	logger = process.env.NODE_ENV === 'production' ? undefined : console.log,
	onSubmit,
	set = defaultSet,
	triggerSelector = triggerSelectors.default,
	validate
}: UseFormOptions<FormValues>) {
	const original$ = writable<FormValues>(undefined, (set) => data.subscribe(set));
	const current$ = writable<FormValues>(undefined, (set) => data.subscribe(set));
	const dirtyFields$ = writable<string[]>([], (set) => original$.subscribe(() => set([])));
	const touchedFields$ = writable<string[]>([], (set) => original$.subscribe(() => set([])));
	const isDirty = derived(dirtyFields$, (dirtyFields) => !!dirtyFields.length);
	const isSubmitting = writable(false);
	const initial_errors = { global: [], fields: {} };
	const errors$ = writable<FormErrors>(initial_errors, (set) => {
		const subscriptions: Unsubscriber[] = [original$.subscribe(() => set(initial_errors))];
		if (validate) {
			const validation_errors: Readable<FormErrors> = derived(current$, (values, set) =>
				validate(values).subscribe((errors) => {
					if (!errors) return;
					set(errors);
				})
			);

			subscriptions.push(validation_errors.subscribe(set));
		}
		return () => {
			subscriptions.forEach((unsubscribe) => unsubscribe());
		};
	});
	const hasGlobalErrors = derived(errors$, ({ global }) => global?.length > 0);
	const hasFieldErrors = derived(errors$, ({ fields = {} }) => Object.keys(fields).length > 0);
	const hasErrors = derived(
		[hasGlobalErrors, hasFieldErrors],
		([globalErrors, fieldErrors]) => globalErrors || fieldErrors
	);

	function submit() {
		isSubmitting.set(true);
		Promise.resolve(onSubmit(getStoreValue(current$)))
			.catch((err) => {
				if (err instanceof FormSubmitError) {
					errors$.set(err.errors);
					logger?.('received submit errors');
				} else {
					logger?.('ignore unhandled error, use FormSubitError to handle errors correctly', err);
				}
			})
			.finally(() => isSubmitting.set(false));
	}

	const fieldConfigs: Record<string, FieldConfig<FormValues>> = {};

	function setValueInDomFromStore(
		element: HTMLInputElement | HTMLSelectElement,
		values: FormValues
	) {
		const name = element.name;
		const { stringify } = fieldConfigs[name];
		const value = get(values, name);

		// The value should be
		if (isSelectElement(element) && element.multiple) {
			const selectedOptions = Array.isArray(value)
				? value.map((optionValue) => stringify(optionValue, name, values))
				: [];

			for (const option of element.options) {
				option.selected = selectedOptions.includes(option.value);
			}
		} else {
			element.value = stringify(value, name, values);
		}
	}

	function setValueInStoreFromDom(property: string, value: string | string[]) {
		const { parse, update } = fieldConfigs[property];
		const current = getStoreValue(current$);
		const parsedValue = Array.isArray(value)
			? value.map((optionValue) => parse(optionValue, property, current))
			: parse(value, property, current);
		let next = set(current, property, parsedValue);

		const edited_keys = [property];
		next = update(property, next, (values, path, value) => {
			edited_keys.push(path);
			return set(values, path, value);
		});
		if (next === current) return; /* Nothing changed */

		current$.set(next);

		const original = getStoreValue(original$);
		const dirtyFields = getStoreValue(dirtyFields$);

		const nextDirtyFields = edited_keys.reduce((acc, edited_key) => {
			const originalValue = get(original, edited_key);
			const nextValue = get(next, edited_key);
			const changed = originalValue !== nextValue;
			if (changed && !acc.includes(edited_key)) {
				return [...acc, edited_key];
			} else if (!changed && acc.includes(edited_key)) {
				return acc.filter((x) => x !== edited_key);
			}
			return acc;
		}, dirtyFields);

		if (nextDirtyFields !== dirtyFields) {
			dirtyFields$.set(nextDirtyFields);
		}
		touchedFields$.update((prev) =>
			edited_keys.reduce((acc, item) => {
				if (acc.includes(item)) return acc;
				return [...acc, item];
			}, prev)
		);
	}

	return {
		data: current$,
		isSubmitting: {
			subscribe: isSubmitting.subscribe
		},
		isDirty,
		dirtyFields: {
			subscribe: dirtyFields$.subscribe
		},
		setValue: setValueInStoreFromDom,
		submit,
		hasErrors,
		hasFieldErrors,
		hasGlobalErrors,
		field: function (fieldElement: HTMLElement) {
			const formElement = findParent(fieldElement, 'form');
			if (!formElement) return;
		},
		form: function (formElement: HTMLFormElement) {
			const subscriptions: Unsubscriber[] = [];
			const formFields: Record<string, Unsubscriber[]> = {};

			function submitForm(event: Event) {
				event.preventDefault();
				submit();
			}
			formElement.addEventListener('submit', submitForm);
			subscriptions.push(() => formElement.removeEventListener('submit', submitForm));

			function addField(element: Element) {
				removeField(element);
				const name = element.name;
				if (!name) return; // TODO: add logging
				if (isInputElement(element) || isSelectElement(element)) {
					logger?.('adding field ', name);
					fieldConfigs[name] = getFieldConfig<FormValues>(element, {
						stringify,
						parse,
						update
					});
					const unsubscribe = current$.subscribe((values) => {
						setValueInDomFromStore(element, values);
					});

					const handleInputChange = () => {
						if (isSelectElement(element) && element.multiple) {
							const values = [];
							for (const option of element.selectedOptions) {
								values.push(option.value);
							}
							setValueInStoreFromDom(name, values);
						} else {
							setValueInStoreFromDom(name, element.value);
						}
					};
					const events = triggerSelector(element);
					events.forEach((event) => element.addEventListener(event, handleInputChange));

					formFields[name] = [
						unsubscribe,
						() => events.forEach((event) => element.removeEventListener(event, handleInputChange)),
						() => delete fieldConfigs[name]
					];
				}
			}
			function addFields(element: Element) {
				addField(element);

				for (const child of element.children) {
					addFields(child);
				}
			}
			function removeField(element: Element) {
				const name = element.name;
				if (!name) return;
				if (isInputElement(element) || isSelectElement(element)) {
					const subscriptions = formFields[name];
					if (!subscriptions) return;

					logger?.('removing field ', name);
					unsubscribe(subscriptions);
					delete formFields[name];
				}
			}
			function removeFields(element: Element) {
				removeField(element);
				for (const child of element.children) {
					removeFields(child);
				}
			}
			function handleChanges(records: MutationRecord[]) {
				records.forEach((record) => {
					if (
						isElement(record.target) &&
						isSelectElement(record.target) &&
						record.type === 'childList'
					) {
						// Check if the field is known
						if (!formFields[record.target.name]) return;

						// Handle this change as a one of... options could be added or removed, the value should be
						// revaluated
						setValueInDomFromStore(record.target, getStoreValue(current$));
					}
					for (const node of record.addedNodes) {
						if (isElement(node)) {
							addFields(node);
						}
					}
					for (const node of record.removedNodes) {
						if (isElement(node)) {
							removeFields(node);
						}
					}
				});
			}
			const observer = new MutationObserver(handleChanges);
			observer.observe(formElement, { childList: true, subtree: true });
			subscriptions.push(() => {
				const outstandingChanges = observer.takeRecords();
				handleChanges(outstandingChanges);
				observer.disconnect();
			});

			addFields(formElement);
			return {
				destroy() {
					unsubscribe(subscriptions);
					subscriptions.length = 0;
					for (const [key, fieldSubscriptions] of Object.entries(formFields)) {
						delete formFields[key];
						unsubscribe(fieldSubscriptions);
					}
				}
			};
		}
	};
}

function getFieldConfig<FormValues>(
	element: Element,
	{ parse, stringify, update }: FieldConfig<FormValues>
) {
	if (parse === undefined) {
		if (isInputElement(element)) {
			switch (element.type) {
				case 'number':
					parse = parseInt;
					break;
			}
		}
	}
	return {
		parse,
		stringify,
		update
	};
}

function unsubscribe(subscriptions: Unsubscriber[]) {
	for (let i = 0; i < subscriptions.length; i++) {
		subscriptions[i]();
	}
}

export const parseInt = (value: string) => {
	if (value === '') return undefined;
	const parsed = Number(value);
	return isNaN(parsed) ? undefined : parsed;
};
