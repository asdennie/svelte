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
	fields?: Record<string, Partial<FieldConfig>>;
	get?: typeof defaultGet;
	logger?: (...values: any[]) => void;
	onSubmit: (values: FormValues) => Promise<void> | void;
	set?: typeof defaultSet;
	triggerSelector?: TriggerSelector;
	transform?: (value: unknown) => FormValues;
	validate?: (values: FormValues) => Readable<FormErrors>;
}
interface FieldConfig {
	stringify: (value: any) => string;
	parse: (value: string) => any;
}

export function useForm<FormValues>({
	data,
	fields = {},
	get = defaultGet,
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

	const fieldConfigs: Record<string, FieldConfig> = {};

	function setValueInDomFromStore(
		element: HTMLInputElement | HTMLSelectElement,
		values: FormValues
	) {
		const name = element.name;
		const { stringify } = fieldConfigs[name];
		const value = get(values, name);

		// The value should be
		if (isSelectElement(element) && element.multiple) {
			const selectedOptions = Array.isArray(value) ? value.map(stringify) : [];

			for (const option of element.options) {
				option.selected = selectedOptions.includes(option.value);
			}
		} else {
			element.value = stringify(value);
		}
	}

	function setValueInStoreFromDom(property: string, value: string | string[]) {
		const { parse } = fieldConfigs[property];
		const current = getStoreValue(current$);
		const parsedValue = Array.isArray(value) ? value.map(parse) : parse(value);
		const next = set(current, property, parsedValue);

		if (next === current) return; /* Nothing changed */

		current$.set(next);

		const original = getStoreValue(original$);
		const originalValue = get(original, property);

		const changed = originalValue !== next;
		const dirtyFields = getStoreValue(dirtyFields$);

		if (changed && !dirtyFields.includes(property)) {
			dirtyFields$.set([...dirtyFields, property]);
		} else if (!changed && dirtyFields.includes(property)) {
			dirtyFields$.set(dirtyFields.filter((field) => property !== field));
		}

		const touchedFields = getStoreValue(touchedFields$);
		if (touchedFields.includes(property)) {
			touchedFields$.set([...touchedFields, property]);
		}
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
					fieldConfigs[name] = getFieldConfig(element, {
						...fields?.[name],
						...fieldConfigs[name]
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
					for (const fieldSubscriptions of Object.values(formFields)) {
						unsubscribe(fieldSubscriptions);
					}
				}
			};
		}
	};
}

function getFieldConfig(element: Element, { parse, stringify }: Partial<FieldConfig>) {
	if (parse === undefined) {
		const defaultParse = (x: string) => x;
		if (isInputElement(element)) {
			switch (element.type) {
				case 'number':
					parse = parseInt;
					break;
				default:
					parse = defaultParse;
			}
		} else {
			parse = defaultParse;
		}
	}
	if (stringify === undefined) {
		const defaultStringify = (x: unknown) => (x === undefined || x === null ? '' : String(x));
		stringify = defaultStringify;
	}
	return {
		parse,
		stringify
	};
}

function unsubscribe(subscriptions: Unsubscriber[]) {
	subscriptions.forEach((x) => x());
}

export const parseInt = (value: string) => {
	if (value === '') return undefined;
	const parsed = Number(value);
	return isNaN(parsed) ? undefined : parsed;
};
