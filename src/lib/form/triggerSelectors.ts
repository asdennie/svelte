import type { TriggerSelector } from './types';

export const triggerSelectors: Record<string, TriggerSelector> = {
	minimal: () => ['change'] as (keyof HTMLElementEventMap)[],
	default: (element) => {
		switch (element.tagName) {
			case 'INPUT':
				return ['input', 'change'];
			default:
				return ['change'];
		}
	}
};
