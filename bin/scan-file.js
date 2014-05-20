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

try {
  var output = pawnScanner.scanFile(process.argv[2]);

  process.stdout.write(JSON.stringify(output));
} catch (e) {
  throw e;

  process.exit(1);
}