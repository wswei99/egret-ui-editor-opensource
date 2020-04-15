import * as path from 'path';
import * as arrays from 'egret/base/common/arrays';
import * as strings from 'egret/base/common/strings';
import * as paths from 'egret/base/common/paths';
import * as platform from 'egret/base/common/platform';
import * as types from 'egret/base/common/types';
import { realpathSync } from 'fs-extra';

/**
 * 路径参数
 * @tslint false
 */
export interface IPathWithLineAndColumn {
	path: string;
	line?: number;
	column?: number;
}


function doValidatePaths(args: string[], gotoLineMode?: boolean): string[] {
	const cwd = process.env['EGRET_CWD'] || process.cwd();
	const result = args.map(arg => {
		let pathCandidate = String(arg);

		let parsedPath: IPathWithLineAndColumn;
		if (gotoLineMode) {
			parsedPath = parseLineAndColumnAware(pathCandidate);
			pathCandidate = parsedPath.path;
		}

		if (pathCandidate) {
			pathCandidate = preparePath(cwd, pathCandidate);
		}

		let realPath: string;
		try {
			realPath = realpathSync(pathCandidate);
		} catch (error) {
			// in case of an error, assume the user wants to create this file
			// if the path is relative, we join it to the cwd
			realPath = path.normalize(path.isAbsolute(pathCandidate) ? pathCandidate : path.join(cwd, pathCandidate));
		}

		const basename = path.basename(realPath);
		if (basename /* can be empty if code is opened on root */ && !paths.isValidBasename(basename)) {
			return null; // do not allow invalid file names
		}

		if (gotoLineMode) {
			parsedPath.path = realPath;
			return toPath(parsedPath);
		}

		return realPath;
	});

	const caseInsensitive = platform.isWindows || platform.isMacintosh;
	const distinct = arrays.distinct(result, e => e && caseInsensitive ? e.toLowerCase() : e);

	return arrays.coalesce(distinct);
}



/**
 * 
 * @param rawPath 原始路径
 * 
 * TODO 暂时保留
 */
export function parseLineAndColumnAware(rawPath: string): IPathWithLineAndColumn {
	const segments = rawPath.split(':'); // C:\file.txt:<line>:<column>

	let path: string;
	let line: number = null;
	let column: number = null;

	segments.forEach(segment => {
		const segmentAsNumber = Number(segment);
		if (!types.isNumber(segmentAsNumber)) {
			path = !!path ? [path, segment].join(':') : segment; // a colon can well be part of a path (e.g. C:\...)
		} else if (line === null) {
			line = segmentAsNumber;
		} else if (column === null) {
			column = segmentAsNumber;
		}
	});

	if (!path) {
		throw new Error('Format for `--goto` should be: `FILE:LINE(:COLUMN)`');
	}

	return {
		path: path,
		line: line !== null ? line : void 0,
		column: column !== null ? column : line !== null ? 1 : void 0 // if we have a line, make sure column is also set
	};
}


function preparePath(cwd: string, p: string): string {

	// Trim trailing quotes
	if (platform.isWindows) {
		p = strings.rtrim(p, '"'); // https://github.com/Microsoft/vscode/issues/1498
	}

	// Trim whitespaces
	p = strings.trim(strings.trim(p, ' '), '\t');

	if (platform.isWindows) {

		// Resolve the path against cwd if it is relative
		p = path.resolve(cwd, p);

		// Trim trailing '.' chars on Windows to prevent invalid file names
		p = strings.rtrim(p, '.');
	}

	return p;
}


function toPath(p: IPathWithLineAndColumn): string {
	const segments = [p.path];

	if (types.isNumber(p.line)) {
		segments.push(String(p.line));
	}

	if (types.isNumber(p.column)) {
		segments.push(String(p.column));
	}

	return segments.join(':');
}