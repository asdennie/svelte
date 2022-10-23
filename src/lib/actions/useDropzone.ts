import { writable } from 'svelte/store';

export function useDropzone(parse: (file: File) => Promise<void>) {
	const progress = writable<{
		parsing: File[];
		failed: { file: File; error: Error }[];
	}>({
		parsing: [],
		failed: []
	});

	function parseFileDrop(element: HTMLInputElement) {
		function filesDropped() {
			const files = readFilesFromFilelist(element.files);
			if (!files) return;

			progress.update((draft) => ({
				...draft,
				parsing: [...draft.parsing, ...files]
			}));
			files.forEach((file) => {
				parse(file)
					.then(() => {
						progress.update(({ parsing, ...draft }) => ({
							...draft,
							parsing: parsing.filter((x) => x !== file)
						}));
					})
					.catch((error) => {
						progress.update(({ parsing, failed }) => ({
							failed: [...failed, { file, error }],
							parsing: parsing.filter((x) => x !== file)
						}));
					});
			});
		}
		element.addEventListener('change', filesDropped);

		return {
			destroy() {
				element.removeEventListener('change', filesDropped);
			}
		};
	}
	return {
		drop: parseFileDrop,
		progress
	};
}
export type TDropzone = ReturnType<typeof useDropzone>;

function readFilesFromFilelist(filelist: FileList | null) {
	if (!filelist || !filelist.length) return undefined;
	const files: File[] = [];
	for (let i = 0; i < filelist.length; i++) {
		const file = filelist.item(i);
		if (file) {
			files.push(file);
		}
	}
	return files;
}
