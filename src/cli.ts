#!/usr/bin/env node

import { Command } from 'commander';
import { saveSnapshot, loadSnapshot, listSnapshots, saveConfig } from './snapshot';
import { diffSnapshots, detectPotentialRenames } from './diff';
import { printDiff, generateTextReport } from './reporter';
import { generateStub } from './stub-generator';
import chalk from 'chalk';

const program = new Command();

program
  .name('mongoose-drift')
  .description('Schema versioning and diff tool for Mongoose')
  .version('1.0.0', '-v, --cli-version');

program
  .command('init')
  .description('Initialize mongoose-drift in this project')
  .requiredOption('--models <path>', 'Path to your Mongoose models directory')
  .option('-p, --project <name>', 'Project/Namespace name', 'default')
  .action(({ models, project }) => {
    try {
      saveConfig(models, project);
      console.log(chalk.green(`\n✔ mongoose-drift initialized for project '${project}'.`));
      console.log(chalk.cyan(`  Add .mongoose-drift/${project}/ to your git repository to track schema history.\n`));
    } catch (err: any) {
      console.error(chalk.red(`\n✖ ${err.message}\n`));
      process.exit(1);
    }
  });

program
  .command('snapshot')
  .description('Save a snapshot of your current Mongoose schemas')
  .requiredOption('--version <version>', 'Version label for this snapshot (e.g. 1.0.0)')
  .option('--models <path>', 'Path to your models directory (overrides config)')
  .option('-p, --project <name>', 'Project/Namespace name', 'default')
  .action(async ({ version, models, project }) => {
    try {
      await saveSnapshot({ version, modelsPath: models, project });
    } catch (err: any) {
      console.error(chalk.red(`\n✖ ${err.message}\n`));
      process.exit(1);
    }
  });

program
  .command('diff <from> <to>')
  .description("Compare two snapshots. Use 'HEAD' for current unsaved state.")
  .option('--stub', 'Generate a migration stub file from the diff')
  .option('--json', 'Output diff as JSON instead of pretty-print')
  .option('--txt [path]', 'Export diff as a text file for manual migration writing')
  .option('-p, --project <name>', 'Project/Namespace name', 'default')
  .action(async (from, to, options) => {
    try {
      const project = options.project;
      const [beforeSnapshot, afterSnapshot] = await Promise.all([
        loadSnapshot(from, project),
        loadSnapshot(to, project),
      ]);

      const result = diffSnapshots(beforeSnapshot, afterSnapshot);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      printDiff(result, from, to);

      for (const [, change] of Object.entries(result.collections)) {
        if (change.type === 'modified' && change.changes) {
          const potentialRenames = detectPotentialRenames(change.changes);
          if (potentialRenames.length > 0) {
            console.log(chalk.yellow('\n⚠  Potential renames detected:'));
            for (const [removed, added] of potentialRenames) {
              console.log(chalk.yellow(`   '${removed}' removed and '${added}' added — is this a rename?`));
              console.log(chalk.yellow(`   If yes, update your stub to use $rename instead of $unset + $set.`));
            }
            console.log('');
          }
        }
      }

      if (options.stub) {
        generateStub(result, from, to, project);
      }

      if (options.txt) {
        import('fs').then(fs => {
          import('path').then(nodePath => {
            const txtContent = generateTextReport(result, from, to);
            const fileName = `${from}-to-${to}-diff.txt`.replace(/\s+/g, '-');
            const outPath = typeof options.txt === 'string' 
              ? nodePath.resolve(process.cwd(), options.txt) 
              : nodePath.resolve(process.cwd(), 'migrations', project, fileName);
              
            fs.mkdirSync(nodePath.dirname(outPath), { recursive: true });
            fs.writeFileSync(outPath, txtContent);
            console.log(chalk.green(`✔ Text diff exported to: ${outPath}`));
          });
        });
      }
    } catch (err: any) {
      console.error(chalk.red(`\n✖ ${err.message}\n`));
      process.exit(1);
    }
  });

program
  .command('log')
  .description('List all saved snapshots')
  .option('-p, --project <name>', 'Project/Namespace name', 'default')
  .action(({ project }) => {
    try {
      const snapshots = listSnapshots(project);
      if (snapshots.length === 0) {
        console.log(chalk.gray(`\nNo snapshots found. Run: mongoose-drift snapshot --version 1.0.0 -p ${project}\n`));
        return;
      }
      console.log(chalk.bold(`\nSaved snapshots for project '${project}':`));
      for (const v of snapshots) {
        console.log(chalk.cyan(`  • ${v}`));
      }
      console.log('');
    } catch (err: any) {
       console.error(chalk.red(`\n✖ ${err.message}\n`));
       process.exit(1);
    }
  });

program
  .command('show <version>')
  .description('Print the schema of a saved snapshot')
  .option('-p, --project <name>', 'Project/Namespace name', 'default')
  .action(async (version, { project }) => {
    try {
      const snapshot = await loadSnapshot(version, project);
      console.log(JSON.stringify(snapshot.collections, null, 2));
    } catch (err: any) {
      console.error(chalk.red(`\n✖ ${err.message}\n`));
      process.exit(1);
    }
  });

program.parse(process.argv);
