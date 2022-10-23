import type { FormErrors } from './types';

export class FormSubmitError extends Error {
	constructor(public errors: FormErrors) {
		super('form submit errors');
		Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
	}
}

export default FormSubmitError;
