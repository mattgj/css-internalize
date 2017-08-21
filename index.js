#!/usr/bin/env node

const path = require('path');
const fs = require('fs-extra');
const program = require('commander');
const chalk = require('chalk');
const commonDir = require('commondir');
const parser = require('./parser');
const defaultConfig = require('./defaultConfig');

function log(msg) {
  process.stdout.write(msg + '\n');
}
program
  .version('0.0.1')
  .usage('[options] <files ...>')
  .option('-r, --root <dir>', 'Root directory')
  .option('-o, --output <dir>', 'Output directory')
  .option('-v, --verbose', 'Verbose logging')
  .option('-c, --config <file>', 'Config file to load')
  .parse(process.argv);

if (program.args.length === 0 || !program.output) {
  program.outputHelp();
  process.exit(1);
}

const verbose = program.verbose;
const inputs = program.args.map(arg => path.resolve(arg));
const outDir = path.resolve(program.output);
const configPath = path.resolve(program.config || './.internalizerc');

const config = fs.exists(configPath)
  ? JSON.parse(fs.readFileSync(configPath))
  : defaultConfig;

if (program.root || config.root) {
  config.root = program.root
    ? path.resolve(program.root)
    : path.resolve(config.root);
}

// Make the uncss instance of jsdom shut up.
// to-do: Fork uncss and add options for this
if (!verbose) {
  console._log = console.log;
  console._error = console.error;
  console.log = () => {};
  console.error = () => {};
}

inputs.forEach(file => {
  log(chalk.blue('Parsing ') + chalk.white.bold(file));
  parser(file, outDir, config, (err, outFile, stats) => {
    if (err) {
      log(chalk.red('Error' + chalk.white.bold(err)));
    } else {
      const prefix = commonDir([file, outFile]);
      const same = file === prefix && outFile === prefix;
      const logPath = same
        ? outFile
        : `${file.replace(prefix, '')}${chalk.green.bold(
            ' -> '
          )}${outFile.replace(prefix, '')}`;

      log(
        chalk.green('Finished ') +
          chalk.white.bold(
            `${logPath} (${stats.oldSize} -> ${stats.newSize}) (${stats.percentage} saved)`
          )
      );
    }
  });
});
