export function useSaveAs<K extends keyof HTMLElementEventMap>(
	save: () => {
		content: string;
		charset?: string;
		mimeType?: string;
		saveAsFilename: string;
	},
	{
		type = 'click' as K
	}: {
		type?: K;
	} = {}
) {
	return function saveAs(target: HTMLElement) {
		function handleSaveAs(e: Event) {
			e.preventDefault();
			const { content, charset = 'utf-8', mimeType = 'text/plain', saveAsFilename } = save();
			const element = target.ownerDocument.createElement('a');
			element.setAttribute(
				'href',
				`data:${mimeType};charset=${charset},` + encodeURIComponent(content)
			);
			element.setAttribute('download', saveAsFilename);

			element.style.display = 'none';
			target.ownerDocument.body.appendChild(element);

			element.click();

			target.ownerDocument.body.removeChild(element);
		}
		target.addEventListener(type, handleSaveAs);
		return {
			destroy() {
				target.removeEventListener(type, handleSaveAs);
			}
		};
	};
}
