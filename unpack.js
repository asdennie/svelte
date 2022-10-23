#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
const packageFolder = './package';
const remove = ['package.json', 'README.MD', '.gitignore'];

function copyDir(src, dest, exclude = () => false) {
	fs.mkdirSync(dest, { recursive: true });
	let entries = fs.readdirSync(src, { withFileTypes: true });

	for (let entry of entries) {
		let srcPath = path.join(src, entry.name);
		if (exclude(srcPath)) continue;

		let destPath = path.join(dest, entry.name);

		if (entry.isDirectory()) {
			copyDir(srcPath, destPath);
			const has_index = fs.existsSync(destPath, 'index.js');
			const has_dts = fs.existsSync(destPath, 'index.d.ts');
			if (has_index || has_dts) {
				const packageJsonContent = {
					type: 'module'
				};
				if (has_index) {
					packageJsonContent.main = `./index.js`;
				}
				if (has_dts) {
					packageJsonContent.types = `./index.d.ts`;
				}
				fs.writeFileSync(
					path.join(destPath, 'package.json'),
					JSON.stringify(packageJsonContent, null, 2),
					{ encoding: 'utf-8' }
				);
			}
		} else {
			fs.copyFileSync(srcPath, destPath);
		}
	}
}
copyDir(packageFolder, './', (path) => !!remove.find((x) => path.endsWith(x)));
