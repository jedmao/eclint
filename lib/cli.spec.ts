import common = require('./test-common');
import sinon = require('sinon');
import path = require('path');
import os = require('os');
import fs = require('fs-extra');
import PluginError = require('plugin-error');
import through = require('through2');
import proxyquire = require('proxyquire');
import getStream = require('get-stream');
const expect = common.expect;

function noop() {
	return through.obj();
}

function eclint(args, stubs?) {
	const argv = proxyquire('./cli', stubs || {
		'gulp-tap': (callback) => {
			log = sinon.stub(console, 'log');
			callback({
				contents: 'test: console.mock',
			});
			expect(log.lastCall.args).to.be.deep.equal(['test: console.mock']);
			log.restore();
			return noop();
		},
		'gulp-reporter': noop,
	})(args);
	// const argv = require('./cli')(args);
	if (argv.stream) {
		argv.then = (...args) => getStream.array(argv.stream).then(...args);
	}
	return argv;
}

let exit;
let log;
describe('eclint cli', function() {
	this.timeout(6000);
	beforeEach(function () {
		exit = sinon.stub(process, 'exit');
		process.exitCode = 0;
	});

	afterEach(function () {
		process.exitCode = 0;
		exit.restore();
		if (log) {
			log.restore();
		}
	});

	it('Missing sub-command', () => {
		log = sinon.stub(console, 'error');
		const yargs = eclint([]);
		expect(log.lastCall.args).to.have.lengthOf(1);
		sinon.assert.calledWith(log, 'CommandError: Missing required sub-command.');
		expect(yargs.stream).to.be.not.ok;
		log.restore();
	});

	if (os.platform() !== 'win32') {
		it('thomas-lebeau/gulp-gitignore#2', () => {
			const cwd = process.cwd();
			process.chdir('/');
			return eclint(['check', '/etc/hosts']).then(files => {
				process.chdir(cwd);
				expect(files).to.have.length.above(0);
			});
		});
	}

	describe('check', () => {
		it('All Files', () => {
			return eclint(['check']).then(files => {
				files = files.map(file => file.path);
				expect(files).to.have.length.above(10);
				expect(files).that.include(path.resolve(__dirname, '../.gitignore'));
			});
		});
		it('Directories', () => {
			return eclint(['check', 'locales']).then(files => {
				expect(files).to.have.length.above(2);
			});
		});
		it('README.md', () => {
			return eclint(['check', 'README.md']).then(files => {
				expect(files).to.have.lengthOf(1);
			});
		});
		it('images/*', () => {
			return eclint(['check', 'images/**/*']).then(files => {
				expect(files).have.lengthOf(0);
			});
		});
		it('node_modules/.bin/_mocha', () => {
			return eclint(['check', 'node_modules/.bin/_mocha']).then(files => {
				expect(files).have.lengthOf(1);
				expect(files[0]).haveOwnProperty('editorconfig').haveOwnProperty('errors').to.have.length.above(1);
			});
		});
		it('not_exist.*', () => {
			const result = eclint(['check', 'not_exist.*']);
			let errListener = result.stream.listeners('error');
			errListener = errListener[errListener.length - 1];
			log = sinon.stub(console, 'error');
			errListener(new Error('test: console.mock'));
			expect(log.lastCall.args).to.have.lengthOf(1);
			expect(log.lastCall.args[0]).to.be.match(/Error: test: console\.mock/);
			log.reset();
			errListener(new PluginError('gulp-reporter', 'test: console.mock'));
			expect(log.lastCall).to.be.null;
			log.restore();
			process.exitCode = 0;
			return result.then(files => {
				expect(files).have.lengthOf(0);
			});
		});
		it('error of gulp-exclude-gitignore', () => {
			return expect(() => {
				eclint(['check', '/etc/hosts'], {
					'gulp-exclude-gitignore': () => {
						throw new Error('test: gulp-exclude-gitignore mock');
					}
				});
			}).throws('test: gulp-exclude-gitignore mock');
		});
	});
	describe('infer', function() {

		it('lib/**/*', () => {
			return eclint(['infer', '--ini', 'lib/**/*']).then(files => {
				expect(files).have.lengthOf(1);
				expect(files[0].contents.toString()).to.be.match(/\bindent_style = tab\b/);
			});
		});
		it('README.md', () => {
			return eclint(['infer', 'README.md']).then(files => {
				expect(files).have.lengthOf(1);
				const result = JSON.parse(files[0].contents);
				expect(result).haveOwnProperty('end_of_line').and.equal('lf');
				expect(result).haveOwnProperty('insert_final_newline').and.to.be.ok;
			});
		});
		it('All Files', () => {
			return eclint(['infer']).then(files => {
				expect(files).have.lengthOf(1);
				const result = JSON.parse(files[0].contents);
				expect(result).to.deep.equal({
					'charset': '',
					'indent_style': 'tab',
					'indent_size': 0,
					'trim_trailing_whitespace': true,
					'end_of_line': 'lf',
					'insert_final_newline': true,
					'max_line_length': 70
				});
			});
		});
	});

	describe('fix', function() {
		it('README.md', () => {
			eclint(['fix', 'README.md']).then(files => {
				expect(files).to.have.lengthOf(1);
			});
		});
		if (os.tmpdir && fs.mkdtemp) {
			it('All Files with `--dest`', () => {
				return fs.mkdtemp(path.join(os.tmpdir(), 'eclint-')).then(tmpDir => {
					expect(tmpDir).to.be.ok.and.be.a('string');
					return eclint(['fix', '--dest', tmpDir]);
				}).then(files => {
					expect(files).to.have.length.above(10);
				});
			});
		}
		it('All Files', () => {
			eclint(['fix']).then(files => {
				expect(files).to.have.length.above(10);
			});
		});
	});

	it('thomas-lebeau/gulp-gitignore#2', () => {
		return eclint(['check', 'dist/cli.js'], {
			'gulp-tap': noop,
			'gulp-reporter': noop,
			'gulp-gitignore': () => [],
		}).then(files => {
			expect(files).to.have.length.above(0);
		});
	});
});
