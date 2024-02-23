#!/usr/bin/env node

import inquirer from 'inquirer';
import * as fs from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import createDirectoryContents from './createDirectoryContents.js';
import { exec } from 'child_process';

import figlet from 'figlet';
import gradient from 'gradient-string';
import chalkAnimation from 'chalk-animation';
import { createSpinner } from 'nanospinner';
import util from 'util';

const execPromise = util.promisify(exec);
const sleep = (ms = 2000) => new Promise(resolve => setTimeout(resolve, ms));

const CURR_DIR = process.cwd();
const __dirname = dirname(fileURLToPath(import.meta.url));

const CHOICES = fs.readdirSync(`${__dirname}/templates`);

async function main() {
  await initial();
  await creatorIntro();
  await askQuestions();
}
main();
const gitIgnore = `
# See https://help.github.com/articles/ignoring-files/ for more about ignoring files.

# dependencies
/node_modules
/.pnp
.pnp.js
.yarn/install-state.gz

# testing
/coverage

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# local env files
.env*.local
.env

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts
`
const QUESTIONS = [
  {
    name: 'project-name',
    type: 'input',
    message: 'Project name:',
    validate: function (input) {
      if (/^([A-Za-z\-\\_\d])+$/.test(input)) return true;
      else return 'Project name may only include letters, numbers, underscores and hashes.';
    },
  },
  {
    name: 'custom-git-hook',
    type: 'confirm',
    message: 'Do you want to use custom git hooks?',
    default: true,
  },
  {
    name: 'update-dependencies',
    // example of a confirm question Do you want to update your dependencies?(y/N)
    type: 'confirm',
    message: 'Do you want to update your dependencies?',
    default: false,
  },
];
const gitHooks = {
  preCommit: 
`#!/bin/bash
# Run Typecheck, Lint, Prettier to format files before committing
npm run precommit

# Add the files formatted by Prettier to the staging area
git add .
`,
  postMerge:
`#!/bin/bash
# Install dependencies
npm install
`,
};
async function initial() {
  console.clear();
  const msg = `create t3 app`;

  const data = await new Promise((resolve, reject) => {
    figlet(msg, (err, data) => {
      if (err) reject(err);
      resolve(data);
    });
  });
  console.log(gradient.rainbow.multiline(data));
  console.log('\n');
}
async function creatorIntro() {
  const rainbowTitle = chalkAnimation.rainbow('upgraded by Anish-Karthik \n');
  await sleep(2000);
  rainbowTitle.stop();
}
async function askQuestions() {
  const answers = await inquirer.prompt(QUESTIONS);
  const projectChoice = CHOICES[0];
  const projectName = answers['project-name'];
  const templatePath = `${__dirname}/templates/${projectChoice}`;
  const updateDependencies = answers['update-dependencies'];
  const customGitHook = answers['custom-git-hook'];

  const spinner = createSpinner('Creating Project...').start();
  fs.mkdirSync(`${CURR_DIR}/${projectName}`);
  spinner.success('Project created successfully');

  // Initialize git repository
  await instantiateGit();
  // Create project directory and copy template files
  createDirectoryContents(templatePath, projectName);

  if (updateDependencies) {
    (await runCommand(`cd ${projectName} && npm install`, 'Install', 'Dependencies')) &&
      (await runCommand(`cd ${projectName} && npm update --save`, 'Updat', 'Dependencies')) &&
      (await runCommand(`cd ${projectName} && npm update --save-dev`, 'Updat', 'Dev dependencies'));
  }
  if (customGitHook) {
    (await runCommand(`cd ${projectName}`, 'Change', 'Directory', false)) &&
      (await createGitHook(
        'pre-commit',gitHooks.preCommit
      )) &&
      (await createGitHook(
        'post-merge', gitHooks.postMerge
      ));
  }

  console.log(`
    run the following commands to start your project:
    cd ${projectName}
    npm install
    npm run dev
  `);
}
// Execute the CLI command
async function runCommand(commandToRun, cmdName = '', name2 = '', showSpinner = true) {
  const spinner = showSpinner
    ? createSpinner(`${cmdName}ing ${name2.toLowerCase()}...`).start()
    : null;
  try {
    await execPromise(commandToRun);
    spinner?.success(`${name2} ${cmdName.toLowerCase()}ed successfully`);
    return true;
  } catch (error) {
    spinner?.error(`Error ${cmdName.toLowerCase()}ing ${name2.toLowerCase()}`);
    return false;
  }
}
// Create git hooks
async function createGitHook(hookFileName, hookContent) {
  const spinner = showSpinner
  ? createSpinner(`Creating ${hookFileName} hook...`).start()
  : null;
  try {
    const hookPath = `${CURR_DIR}/${projectName}/.git/hooks/${hookFileName}`;
    fs.writeFileSync(hookPath, hookContent);
    await runCommand(`chmod +x ${hookPath}`, 'Change', 'Permission', false);
    spinner?.success(`${hookFileName} hook created successfully`);
    return true;
  } catch (error) {
    spinner?.error(`Error creating ${hookFileName} hook`);
    return false;
  }
}

async function instantiateGit() {
  const spinner = createSpinner('Initializing git repository...').start();
  try {
    await runCommand(`cd ${projectName} && git init`, 'Initialize', 'Git repository', false);
    // CREATE .gitignore
    fs.writeFileSync(`${CURR_DIR}/${projectName}/.gitignore`, gitIgnore);
    spinner.success('Git repository initialized successfully');
  } catch (error) {
    spinner.error('Error initializing git repository');
  }
}

