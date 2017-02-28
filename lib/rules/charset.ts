///<reference path='../../typings/lodash/lodash.d.ts'/>
import _ = require('lodash');
import linez = require('linez');
import eclint = require('../eclint');
import EditorConfigError =  require('../editor-config-error');

var boms = {
	'utf-8-bom': '\u00EF\u00BB\u00BF',
	'utf-16be': '\u00FE\u00FF',
	'utf-32le': '\u00FF\u00FE\u0000\u0000',
	'utf-16le': '\u00FF\u00FE',
	'utf-32be': '\u0000\u0000\u00FE\u00FF'
};

function resolve(settings: eclint.Settings) {
	return settings.charset;
}

function check(settings: eclint.Settings, doc: linez.Document) {
	function creatErrorArray(message: string) {
		var error = new EditorConfigError(message);
		error.source = doc.toString();
		error.rule = 'charset';
		return [error];
	}
	var inferredSetting = infer(doc);
	var configSetting = resolve(settings);
	if (inferredSetting) {
		if (inferredSetting !== settings.charset) {
			return creatErrorArray('invalid charset: ' + inferredSetting + ', expected: ' + configSetting);
		}
		return [];
	}
	if (configSetting === 'latin1') {
		var errors = doc.lines.map(checkLatin1TextRange.bind(this, settings));
		return [].concat.apply([], errors);
	}
	if (_.contains(Object.keys(boms), configSetting)) {
		return creatErrorArray('expected charset: ' + settings.charset);
	}
	return [];
}

function fix(settings: eclint.Settings, doc: linez.Document) {
	doc.charset = resolve(settings);
	return doc;
}

function infer(doc: linez.Document): string {
	return doc.charset;
}

function checkLatin1TextRange(
	settings: eclint.Settings,
	line: linez.Line
) {
	return [].slice.call(line.text, 0).map(function(character: string, i: number) {
		if (character.charCodeAt(0) >= 0x80) {
			var error = new EditorConfigError('character out of latin1 range: ' + JSON.stringify(character));
			error.lineNumber = line.number;
			error.columnNumber = i + 1;
			error.source = line.text;
			error.rule = 'charset';
			return error;
		}
	}).filter(Boolean);
}

var CharsetRule: eclint.DocumentRule = {
	type: 'DocumentRule',
	resolve: resolve,
	check: check,
	fix: fix,
	infer: infer
};

export = CharsetRule;
