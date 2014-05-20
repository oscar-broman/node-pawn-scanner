#!/usr/bin/env node
'use strict';

var fs = require('fs');
var util = require('util');
var pawnScanner = require('../lib/pawn-scanner');

if (process.argv.length !== 3) {
  console.error('Usage: scan-dir <dirname>');

  process.exit(1);
} else if (!fs.existsSync(process.argv[2])) {
  console.error('Error: Invalid dir given');

  process.exit(1);
}

var stats = fs.statSync(process.argv[2]);

if (!stats.isDirectory()) {
  console.error('Error: Invalid dir given');

  process.exit(1);
}

var output = pawnScanner.scanDir(process.argv[2]);

console.log(util.inspect(output, { depth: null }));