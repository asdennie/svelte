export function isElement(node: Node): node is Element {
	return node.nodeType === node.ELEMENT_NODE;
}
export function isInputElement(element: Element): element is HTMLInputElement {
	return 'INPUT' === element.tagName;
}
export function isSelectElement(element: Element): element is HTMLSelectElement {
	return 'SELECT' === element.tagName;
}
export function findParent(element: Element, selector: string): Element | undefined {
	if (element.matches(selector)) {
		return element;
	}
	if (element.parentElement) return findParent(element.parentElement, selector);
}
