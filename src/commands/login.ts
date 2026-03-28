import { getBrowser, saveCookies, closeBrowser } from '../scraper/browser.js';
import { log } from '../utils/logger.js';
import chalk from 'chalk';

export async function loginCommand() {
  log.section('Bazaraki Login');
  console.log(chalk.dim('Открывается браузер — залогинься на Bazaraki вручную.'));
  console.log(chalk.dim('После входа вернись сюда и нажми Enter.\n'));

  const { context } = await getBrowser();
  const page = await context.newPage();

  await page.goto('https://www.bazaraki.com/profile/login/', {
    waitUntil: 'domcontentloaded',
  });

  log.info('Браузер открыт. Залогинься и нажми Enter здесь...');

  // Ждём Enter от пользователя
  await new Promise<void>((resolve) => {
    process.stdin.setRawMode?.(false);
    process.stdin.resume();
    process.stdin.once('data', () => resolve());
  });

  await saveCookies();
  await page.close();
  await closeBrowser();

  log.success('Куки сохранены. Теперь scrape будет видеть телефоны.');
}
