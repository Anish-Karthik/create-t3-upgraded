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
    default: false,
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
  preCommit: `#!/bin/bash
# Run Typecheck, Lint, Prettier to format files before committing
npm run precommit

# Add the files formatted by Prettier to the staging area
git add .
`,
  postMerge: `#!/bin/bash
# Install dependencies
npm install
`,
};

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
`;
class TemplateCLI {
  constructor() {
    this.projectName = '';
    this.templatePath = `${__dirname}/templates/${CHOICES[0]}`;
  }

  async initial() {
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

  async creatorIntro() {
    const rainbowTitle = chalkAnimation.rainbow('upgraded by Anish-Karthik \n');
    await sleep(2000);
    rainbowTitle.stop();
  }

  async askQuestions() {
    const answers = await inquirer.prompt(QUESTIONS);
    const projectChoice = CHOICES[0];
    this.projectName = answers['project-name'];
    this.templatePath = `${__dirname}/templates/${projectChoice}`;
    const updateDependencies = answers['update-dependencies'];
    const customGitHook = answers['custom-git-hook'];

    const spinner = createSpinner('Creating Project...').start();
    fs.mkdirSync(`${CURR_DIR}/${this.projectName}`);
    spinner.success('Project created successfully');

    // Create project directory and copy template files
    createDirectoryContents(this.templatePath, this.projectName);
    // Initialize git repository
    await this.instantiateGit();

    await this.copyEnvFile();
    if (updateDependencies) {
      (await this.runCommand(`cd ${this.projectName} && npm install`, 'Install', 'Dependencies')) &&
        (await this.runCommand(
          `cd ${this.projectName} && npm update --save`,
          'Updat',
          'Dependencies'
        )) &&
        (await this.runCommand(
          `cd ${this.projectName} && npm update --save-dev`,
          'Updat',
          'Dev dependencies'
        ));
    }
    if (customGitHook) {
      (await this.runCommand(`cd ${this.projectName}`, 'Change', 'Directory', false)) &&
        (await this.createGitHook('pre-commit', gitHooks.preCommit)) &&
        (await this.createGitHook('post-merge', gitHooks.postMerge));
    }

    console.log(`
      run the following commands to start your project:
      cd ${this.projectName}
      npm install
      npm run dev
    `);
  }

  async runCommand(commandToRun, cmdName = '', name2 = '', showSpinner = true) {
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

  async createGitHook(hookFileName, hookContent, showSpinner = true) {
    const spinner = showSpinner ? createSpinner(`Creating ${hookFileName} hook...`).start() : null;
    try {
      const hookPath = `${CURR_DIR}/${this.projectName}/.git/hooks/${hookFileName}`;
      fs.writeFileSync(hookPath, hookContent);
      await this.runCommand(`chmod +x ${hookPath}`, 'Change', 'Permission', false);
      spinner?.success(`${hookFileName} hook created successfully`);
      return true;
    } catch (error) {
      spinner?.error(`Error creating ${hookFileName} hook`);
      return false;
    }
  }

  async copyEnvFile() {
    const spinner = createSpinner('Creating .env file...').start();
    try {
      // copy .env.example into .env file
      // create .env file
      fs.writeFileSync(`${CURR_DIR}/${this.projectName}/.env`, '');
      fs.copyFileSync(`${this.templatePath}/.env.example`, `${CURR_DIR}/${this.projectName}/.env`);
      spinner.success('.env file created successfully');
    } catch (error) {
      spinner.error('Error creating .env file');
    }
  }

  async createGitIgnore() {
    const spinner = createSpinner('Creating .gitignore file...').start();
    try {
      fs.writeFileSync(`${CURR_DIR}/${this.projectName}/.gitignore`, gitIgnore);
      spinner.success('.gitignore file created successfully');
    } catch (error) {
      spinner.error('Error creating .gitignore file');
    }
  }

  async instantiateGit() {
    const spinner = createSpinner('Initializing git repository...').start();
    try {
      await this.runCommand(
        `cd ${this.projectName} && git init`,
        'Initialize',
        'Git repository',
        false
      );
      // CREATE .gitignore
      await this.createGitIgnore();
      spinner.success('Git repository initialized successfully');
    } catch (error) {
      console.log(error);
      spinner.error('Error initializing git repository');
    }
  }
}

async function main() {
  const templateCLI = new TemplateCLI();
  await templateCLI.initial();
  await templateCLI.creatorIntro();
  await templateCLI.askQuestions();
}
main();
