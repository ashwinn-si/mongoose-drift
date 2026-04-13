import chalk from 'chalk';
import { DiffResult, FieldChange } from './types';

function formatFieldChange(change: FieldChange): string {
  const typeStr = change.after?.type ?? change.before?.type ?? 'Unknown';

  switch (change.type) {
    case 'added':
      return chalk.green(`  + ${change.field.padEnd(25)} (${typeStr})  [FIELD ADDED]`);

    case 'removed':
      return chalk.red(`  - ${change.field.padEnd(25)} (${typeStr})  [FIELD REMOVED]`);

    case 'modified':
      const before = JSON.stringify(change.before);
      const after = JSON.stringify(change.after);
      return chalk.yellow(`  ~ ${change.field.padEnd(25)} ${before} → ${after}  [MODIFIED]`);

    case 'renamed':
      return chalk.blue(`  ↷ ${change.renamedFrom} → ${change.field}  [RENAMED]`);

    default:
      return '';
  }
}

export function printDiff(result: DiffResult, from: string, to: string): void {
  const collections = Object.entries(result.collections);

  if (collections.length === 0) {
    console.log(chalk.gray(`\nNo schema changes detected between ${from} and ${to}.\n`));
    return;
  }

  console.log(chalk.bold(`\nSchema diff: ${chalk.cyan(from)} → ${chalk.cyan(to)}\n`));

  for (const [name, change] of collections) {
    console.log(chalk.bold(`Collection: ${name}`));

    if (change.type === 'added') {
      console.log(chalk.green(`  ✦ New collection detected`));
    } else if (change.type === 'removed') {
      console.log(chalk.red(`  ✖ Collection removed`));
    } else if (change.type === 'modified' && change.changes) {
      for (const fieldChange of change.changes) {
        console.log(formatFieldChange(fieldChange));
      }
    }

    console.log('');
  }

  const added = collections.filter(([, c]) => c.type === 'added').length;
  const removed = collections.filter(([, c]) => c.type === 'removed').length;
  const modified = collections.filter(([, c]) => c.type === 'modified').length;

  console.log(
    chalk.bold('Summary: ') +
    chalk.green(`${added} added  `) +
    chalk.red(`${removed} removed  `) +
    chalk.yellow(`${modified} modified`)
  );
}

function formatFieldChangeText(change: FieldChange): string {
  const typeStr = change.after?.type ?? change.before?.type ?? 'Unknown';

  switch (change.type) {
    case 'added':
      return `  + ${change.field.padEnd(25)} (${typeStr})  [FIELD ADDED]`;

    case 'removed':
      return `  - ${change.field.padEnd(25)} (${typeStr})  [FIELD REMOVED]`;

    case 'modified':
      const before = JSON.stringify(change.before);
      const after = JSON.stringify(change.after);
      return `  ~ ${change.field.padEnd(25)} ${before} → ${after}  [MODIFIED]`;

    case 'renamed':
      return `  ↷ ${change.renamedFrom} → ${change.field}  [RENAMED]`;

    default:
      return '';
  }
}

export function generateTextReport(result: DiffResult, from: string, to: string): string {
  const collections = Object.entries(result.collections);
  const lines: string[] = [];

  if (collections.length === 0) {
    lines.push(`No schema changes detected between ${from} and ${to}.`);
    return lines.join('\n');
  }

  lines.push(`Schema diff: ${from} → ${to}`);
  lines.push('');

  for (const [name, change] of collections) {
    lines.push(`Collection: ${name}`);

    if (change.type === 'added') {
      lines.push(`  ✦ New collection detected`);
    } else if (change.type === 'removed') {
      lines.push(`  ✖ Collection removed`);
    } else if (change.type === 'modified' && change.changes) {
      for (const fieldChange of change.changes) {
        lines.push(formatFieldChangeText(fieldChange));
      }
    }

    lines.push('');
  }

  const added = collections.filter(([, c]) => c.type === 'added').length;
  const removed = collections.filter(([, c]) => c.type === 'removed').length;
  const modified = collections.filter(([, c]) => c.type === 'modified').length;

  lines.push(`Summary: ${added} added  |  ${removed} removed  |  ${modified} modified`);

  return lines.join('\n');
}
