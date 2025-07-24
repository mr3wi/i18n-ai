#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { FileScanner } from './scanner';
import { join } from 'path';
import { existsSync, writeFileSync } from 'fs';

const program = new Command();

// Configuration globale
program.name('translate-ai').description('AI-powered translation assistant for developers').version('0.1.0');

// Commande: scan
program
  .command('scan')
  .description('Scan project for translatable strings')
  .option('-d, --dir <directory>', 'Project directory to scan', '.')
  .option('-o, --output <file>', 'Output file for results', 'translatable-strings.json')
  .option('-p, --patterns <patterns...>', 'File patterns to include')
  .option('-e, --exclude <patterns...>', 'Patterns to exclude')
  .action(async (options) => {
    const spinner = ora('Initializing scan...').start();

    try {
      const scanner = new FileScanner();

      spinner.text = 'Scanning files for translatable strings...';

      const results = await scanner.scan(options.dir, {
        patterns: options.patterns,
        exclude: options.exclude,
      });

      spinner.stop();

      scanner.generateSummary(results);
      scanner.exportToJSON(results, options.output);

      if (results.length > 0) {
        console.log(chalk.green('\n✨ Scan completed successfully!'));
        console.log(chalk.blue(`💡 Next: Run 'translate-ai generate' to create translations`));
      } else {
        console.log(chalk.yellow('\n⚠️  No translatable strings found.'));
      }
    } catch (error) {
      spinner.stop();
      console.error(chalk.red('❌ Scan failed:'), error);
      process.exit(1);
    }
  });

// Commande: init
program
  .command('init')
  .description('Initialize translate-ai configuration')
  .action(async () => {
    console.log(chalk.blue('🚀 Welcome to translate-ai!\n'));

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'projectName',
        message: 'Project name:',
        default: 'my-project',
      },
      {
        type: 'checkbox',
        name: 'frameworks',
        message: 'Which frameworks are you using?',
        choices: [
          { name: 'React', value: 'react', checked: true },
          { name: 'Vue.js', value: 'vue' },
          { name: 'Angular', value: 'angular' },
          { name: 'Vanilla JS', value: 'vanilla' },
        ],
      },
      {
        type: 'checkbox',
        name: 'languages',
        message: 'Which languages do you want to support?',
        choices: [
          { name: 'English (en)', value: 'en', checked: true },
          { name: 'French (fr)', value: 'fr' },
          { name: 'Spanish (es)', value: 'es' },
          { name: 'German (de)', value: 'de' },
          { name: 'Italian (it)', value: 'it' },
        ],
      },
      {
        type: 'input',
        name: 'outputDir',
        message: 'Translation files directory:',
        default: './locales',
      },
    ]);

    const config = {
      projectName: answers.projectName,
      frameworks: answers.frameworks,
      languages: answers.languages,
      outputDir: answers.outputDir,
      filePatterns: generateFilePatterns(answers.frameworks),
      excludePatterns: ['node_modules/**', 'dist/**', 'build/**', '.git/**', '**/*.test.*', '**/*.spec.*'],
      createdAt: new Date().toISOString(),
    };

    const configPath = 'translate-ai.config.json';
    writeFileSync(configPath, JSON.stringify(config, null, 2));

    console.log(chalk.green(`\n✅ Configuration saved to ${configPath}`));
    console.log(chalk.blue('💡 Next steps:'));
    console.log(chalk.blue('  1. Run: translate-ai scan'));
    console.log(chalk.blue('  2. Run: translate-ai generate'));
  });

// Commande: generate (placeholder)
program
  .command('generate')
  .description('Generate translations using AI')
  .option('-f, --file <file>', 'Input file with extracted strings', 'translatable-strings.json')
  .action(async (options) => {
    if (!existsSync(options.file)) {
      console.error(chalk.red(`❌ File not found: ${options.file}`));
      console.log(chalk.blue('💡 Run "translate-ai scan" first to extract strings'));
      return;
    }

    console.log(chalk.yellow('🚧 Translation generation coming soon!'));
    console.log(chalk.blue('This will integrate with AI services like:'));
    console.log('  • OpenAI GPT');
    console.log('  • Google Translate');
    console.log('  • DeepL');
    console.log('  • Custom translation models');
  });

// Commande: status
program
  .command('status')
  .description('Show project translation status')
  .action(() => {
    const configExists = existsSync('translate-ai.config.json');
    const stringsExists = existsSync('translatable-strings.json');

    console.log(chalk.blue('📊 Project Status\n'));

    console.log(`Configuration: ${configExists ? chalk.green('✅ Found') : chalk.red('❌ Missing')}`);
    console.log(`Extracted strings: ${stringsExists ? chalk.green('✅ Found') : chalk.red('❌ Missing')}`);

    if (!configExists) {
      console.log(chalk.blue('\n💡 Run "translate-ai init" to get started'));
    } else if (!stringsExists) {
      console.log(chalk.blue('\n💡 Run "translate-ai scan" to extract strings'));
    } else {
      console.log(chalk.green('\n✨ Ready to generate translations!'));
    }
  });

function generateFilePatterns(frameworks: string[]): string[] {
  const patterns: string[] = [];

  if (frameworks.includes('react')) {
    patterns.push('**/*.{js,jsx,ts,tsx}');
  }
  if (frameworks.includes('vue')) {
    patterns.push('**/*.vue');
  }
  if (frameworks.includes('angular')) {
    patterns.push('**/*.{ts,html}');
  }
  if (frameworks.includes('vanilla')) {
    patterns.push('**/*.{js,html}');
  }

  return patterns.length > 0 ? patterns : ['**/*.{js,jsx,ts,tsx}'];
}

// Handle errors
program.on('command:*', () => {
  console.error(chalk.red('❌ Invalid command: %s'), program.args.join(' '));
  console.log(chalk.blue('💡 Run "translate-ai --help" for available commands'));
  process.exit(1);
});

if (process.argv.length === 2) {
  program.help();
}

program.parse();
