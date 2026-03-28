#!/usr/bin/env node
import { Command } from 'commander';
import { loginCommand } from './commands/login.js';
import { scrapeCommand } from './commands/scrape.js';
import { listCommand } from './commands/list.js';
import { analyzeCommand, analyzeAllCommand } from './commands/analyze.js';
import { contactCommand } from './commands/contact.js';
import { replyCommand } from './commands/reply.js';
import { dashboardCommand } from './commands/dashboard.js';

const program = new Command();

program
  .name('bazaraki-cars')
  .description('Cyprus used car buyer assistant — Bazaraki + WhatsApp + AI')
  .version('1.0.0');

program
  .command('login')
  .description('Открыть браузер для входа на Bazaraki (сохраняет куки)')
  .action(loginCommand);

program
  .command('scrape')
  .description('Scrape new listings from Bazaraki.com')
  .option('-p, --pages <n>', 'Max pages to scrape (default: from config)', '5')
  .option('-d, --district <district>', 'Filter by district: nicosia, limassol, larnaca, paphos')
  .action(scrapeCommand);

program
  .command('list')
  .description('Show stored listings')
  .option('-s, --status <status>', 'Filter by status: new, analyzed, contacted, negotiating, rejected, bought')
  .option('-b, --brand <brand>', 'Filter by brand (e.g. toyota)')
  .option('--max-price <eur>', 'Filter by max price in EUR')
  .option('-n, --limit <n>', 'Max rows to show', '50')
  .action(listCommand);

program
  .command('analyze <id>')
  .description('AI-analyze a specific listing by ID')
  .action(analyzeCommand);

program
  .command('analyze-all')
  .description('Analyze all new (un-analyzed) listings')
  .action(analyzeAllCommand);

program
  .command('contact <id>')
  .description('Generate WhatsApp opening message for a listing')
  .action(contactCommand);

program
  .command('reply <id>')
  .description('Continue conversation — paste seller reply, get AI follow-up')
  .action(replyCommand);

program
  .command('dashboard')
  .description('Overview: status counts, hot listings, active negotiations')
  .action(dashboardCommand);

program.parse();
