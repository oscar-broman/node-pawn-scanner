#!/usr/bin/env node
'use strict';

var fs = require('fs');
var util = require('util');
var pawnScanner = require('../lib/pawn-scanner');

if (process.argv.length !== 3) {
	console.error('Usage: scan-file <filename>');

	process.exit(1);
} else if (!fs.existsSync(process.argv[2])) {
	console.error('Error: Invalid filename given');

	process.exit(1);
}

var output = pawnScanner.scanFile(process.argv[2]);

console.log(util.inspect(output, { depth: null }));