#!/usr/bin/env node

const ora = require('ora');
const chalk = require('chalk');
const meow = require('meow');
const inquirer = require('inquirer');
api = require('./api');
const crawl = require('./crawl');

const cli = meow(`
    Usage
	  $ instagram-profilecrawl <name>

	Examples
	  $ instagram-profilecrawl nacimgoura
`);

// init spinner
const spinnerLoading = ora(chalk.blue('Init script!'));

// test if name is entered
const profileName = cli.input;
if (!profileName.length) {
    spinnerLoading.fail(chalk.red('No name entered!'));
    process.exit();
}

api.start(profileName);