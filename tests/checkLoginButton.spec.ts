import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import * as XLSX from 'xlsx';
const { RunReporter } = require('./reporter');
const toMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));


test.setTimeout(120000000); 
test('Check Partner pages if Login is present', async ({ page }) => {
  const reporter = new RunReporter();
reporter.log({
  module: 'Check Partner pages if Login is present',
  step: 'test_start',
  //status: 'INFO',
 // message: 'START'
});

  // Resolve Excel path in common locations
  const candidates = [
    path.resolve(__dirname, '../urls/LogoCheck.xlsx'),
    path.resolve(__dirname, './urls/LogoCheck.xlsx')
  ];
  const excelPath = candidates.find(p => fs.existsSync(p));
  if (!excelPath) {
    test.skip(true, 'LogoCheck.xlsx not found in expected locations');
  }

  const wb = XLSX.readFile(excelPath!);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: Array<{ URL: string; Name?: string }> = XLSX.utils.sheet_to_json(sheet);

  const screenshotBaseDirs = [
    path.resolve(__dirname, './results')
  ];
  let screenshotDir = screenshotBaseDirs.find(p => fs.existsSync(p));
  if (!screenshotDir) {
    screenshotDir = screenshotBaseDirs[0];
  }
  try { fs.mkdirSync(screenshotDir, { recursive: true }); } catch {}

  const sanitizeForFilename = (s: string) => s.replace(/[^a-z0-9-_]/gi, '_').toLowerCase();

  type ResultRow = {
    URL: string;
    LoginVisible: 'YES' | 'NO';
    LoginRedirect: 'YES' | 'NO';
    ScreenshotPath: string;
    ScreenshotTaken: 'YES' | 'NO';
    Error?: string;
  };

  const results: ResultRow[] = [];

  for (const row of rows) {
    if (!row.URL) continue;
    let hostPart = '';
    try { hostPart = new URL(row.URL).hostname.replace(/^www\./, ''); } catch {}
    const fileStem = sanitizeForFilename(hostPart || 'url');
    const screenshotPath = path.join(screenshotDir, `${fileStem}.png`);

    let loginVisible: 'YES' | 'NO' = 'NO';
    let loginRedirect: 'YES' | 'NO' = 'NO';
    let screenshotTaken: 'YES' | 'NO' = 'NO';
    let errorMessage = '';
    const stepName = row.Name?.trim() || row.URL;

    try {
      await test.step(stepName, async () => {
        await page.goto(row.URL, { waitUntil: 'domcontentloaded' });
        try {
          const loginLink = page.getByRole('link', { name: 'Login' });
          await test.step('Check for Login Button', async () => {
           // reporter.log({ module: stepName, step: 'Check for Login Button', status: 'INFO', message: 'START' });
            try {
              const isLoginVisible = await loginLink.isVisible();
              loginVisible = isLoginVisible ? 'YES' : 'NO';
              await expect.soft(loginLink).toBeVisible();
              reporter.log({ module: stepName, step: 'Check for Login Button', status: 'PASS', message: 'PASS' });
              if(loginVisible === 'NO') {
                reporter.log({ module: stepName, step: 'Check for Login Button', status: 'FAIL', message: 'Login link not visible' });
              }
            } catch (e) {
              reporter.log({ module: stepName, step: 'Check for Login Button', status: 'FAIL', message: toMsg(e) });
              throw e;
            }
          });

          if (loginVisible === 'YES') {
            await test.step('Click Login link and verify URL', async () => {
              //reporter.log({ module: stepName, step: 'Click Login link and verify URL', status: 'INFO', message: 'START' });
              try {
                await loginLink.click();
                try {
                  await expect(page).toHaveURL('https://ltcrplus.com/your-family-member-needs-care/#onlineLegalBenefits');
                  loginRedirect = 'YES';
                  reporter.log({ module: stepName, step: 'Click Login link and verify URL', status: 'PASS', message: 'PASS' });
                } catch {
                  loginRedirect = 'NO';
                  reporter.log({ module: stepName, step: 'Click Login link and verify URL', status: 'FAIL', message: 'Redirect URL did not match' });
                }
              } catch (e) {
                reporter.log({ module: stepName, step: 'Click Login link and verify URL', status: 'FAIL', message: toMsg(e) });
                throw e;
              }
            });
          }

        } catch (e) {
          loginVisible = 'NO';
          loginRedirect = 'NO';
        }
        await page.screenshot({ path: screenshotPath, fullPage: true });
        screenshotTaken = 'YES';
      });


      
    } catch (e) {
      screenshotTaken = 'NO';
    }

    results.push({
      URL: row.URL,
      LoginVisible: loginVisible,
      LoginRedirect: loginRedirect,
      ScreenshotPath: screenshotPath,
      ScreenshotTaken: screenshotTaken,
     // Error: errorMessage || undefined,
    });

    console.log([`Result for ${row.URL}: ${screenshotTaken}`, `Screenshot: ${screenshotPath}`].join(' | '));
  }

  // Write results.xlsx next to the source workbook
  const outDir = path.dirname(excelPath!);
  const ws = XLSX.utils.json_to_sheet(results.map((r: ResultRow) => ({
    URL: r.URL,
    'Login visible?(yes/no)': r.LoginVisible,
    'Login redirect (yes/no)': r.LoginRedirect,
    //'Screenshot Taken?': r.ScreenshotTaken,
   // 'Screenshot Path': r.ScreenshotPath,
  //  'Error': r.Error || '',
  })));
  const wbOut = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbOut, ws, 'Results');
  const outPath = path.join(outDir, 'results.xlsx');
  XLSX.writeFile(wbOut, outPath);
  console.log(`Results written to: ${outPath}`);
  console.log(`Processed ${results.length} URL(s).`);
});