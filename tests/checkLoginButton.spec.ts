/// <reference types="node" />

import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { TIMEOUT } from 'dns';
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

test('Partner pages checks', async ({ page }) => {
  const reporter = new RunReporter();
  reporter.log({
  module: 'Check if Request for Complimentary Evaluation section is present',
  step: ' ',
  status: 'INFO',
  message: 'START'
});

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



  for (const row of rows) {
    if (!row.URL) continue;
    let hostPart = '';
    try { hostPart = new URL(row.URL).hostname.replace(/^www\./, ''); } catch {}
    const fileStem = sanitizeForFilename(hostPart || 'url');
    const screenshotPath = path.join(screenshotDir, `${fileStem}.png`);

    let buttonVisible: 'YES' | 'NO' = 'NO';
    let buttonRedirect: 'YES' | 'NO' = 'NO';
    let screenshotTaken: 'YES' | 'NO' = 'NO';
    let errorMessage = '';
    const stepName = row.Name?.trim() || row.URL;

    try {
      await test.step(stepName, async () => {
        await page.goto(row.URL, { waitUntil: 'domcontentloaded' });
        
        await test.step('Navigate through Advice and Counseling', async () => {
        try {
          await page.getByRole('link', { name: ' Advice & Counseling' }).click();
          await expect(page).toHaveURL(/family-benefits\/#adviceAndCounseling$/);
          await page.goto(row.URL, { waitUntil: 'domcontentloaded' });
          reporter.log({ module: stepName, step: 'Navigate through Advice and Counseling', status: 'PASS', message: 'PASS' });
        } catch (e) {
          reporter.log({ module: stepName, step: 'Navigate through Advice and Counseling', status: 'FAIL', message: toMsg(e) });
          throw e;
        }
        });
        
        await test.step('Navigate through Care Navigation', async () => {
        try {
          await page.getByRole('link', { name: ' Care Navigation' }).click();
          await expect(page).toHaveURL(/family-benefits\/#careNavigation$/);
          await page.goto(row.URL, { waitUntil: 'domcontentloaded' });
          reporter.log({ module: stepName, step: 'Navigate through Care Navigation', status: 'PASS', message: 'PASS' });
        } catch (e) {
          reporter.log({ module: stepName, step: 'Navigate through Care Navigation', status: 'FAIL', message: toMsg(e) });
          throw e;
        }
        });

        await test.step('Navigate through Claims Assistance', async () => {
        try {
          await page.getByRole('link', { name: ' Claims Assistance' }).click();
          await expect(page).toHaveURL(/family-benefits\/#claimsAssistance$/);
          await page.goto(row.URL, { waitUntil: 'domcontentloaded' });
          reporter.log({ module: stepName, step: 'Navigate through Claims Assistance', status: 'PASS', message: 'PASS' });
        } catch (e) {
          reporter.log({ module: stepName, step: 'Navigate through Claims Assistance', status: 'FAIL', message: toMsg(e) });
          throw e;
        }
        });

        await test.step('Navigate through Maximize Benefits', async () => {
        try {
          await page.getByRole('link', { name: ' Maximize Benefits' }).click();
          await expect(page).toHaveURL(/family-benefits\/#maximizeBenefits$/);
          await page.goto(row.URL, { waitUntil: 'domcontentloaded' });
          reporter.log({ module: stepName, step: 'Navigate through Maximize Benefits', status: 'PASS', message: 'PASS' });
        } catch (e) {
          reporter.log({ module: stepName, step: 'Navigate through Maximize Benefits', status: 'FAIL', message: toMsg(e) });
          throw e;
        }
        });

        await test.step('Navigate through Online Legal Benefits', async () => {
        try {
          await page.getByRole('link', { name: ' Online Legal Benefits' }).click();
          await expect(page).toHaveURL(/family-benefits\/#onlineLegalBenefits$/);
          await page.goto(row.URL, { waitUntil: 'domcontentloaded' });
          reporter.log({ module: stepName, step: 'Navigate through Online Legal Benefits', status: 'PASS', message: 'PASS' });
        } catch (e) {
          reporter.log({ module: stepName, step: 'Navigate through Online Legal Benefits', status: 'FAIL', message: toMsg(e) });
          throw e;
        }
        });

        await test.step('Navigate through Contact Us', async () => {
        try {
          await page.getByRole('link', { name: 'Contact Us' }).click();
          await expect(page).toHaveURL(/contact-us\/$/);
          await page.goto(row.URL, { waitUntil: 'domcontentloaded' });
          reporter.log({ module: stepName, step: 'Navigate through Contact Us', status: 'PASS', message: 'PASS' });
        } catch (e) {
          reporter.log({ module: stepName, step: 'Navigate through Contact Us', status: 'FAIL', message: toMsg(e) });
          throw e;
        }
        });


        await test.step('Navigate through Login Button', async () => {
        try {
          await page.getByRole('link', { name: 'Login' }).click();
          await expect(page).toHaveURL(/family-benefits\/#onlineLegalBenefits$/);
          await page.goto(row.URL, { waitUntil: 'domcontentloaded' });
          reporter.log({ module: stepName, step: 'Navigate through Care Discounts', status: 'PASS', message: 'PASS' });
        } catch (e) {
          reporter.log({ module: stepName, step: 'Navigate through Care Discounts', status: 'FAIL', message: toMsg(e) });
          throw e;
        }
        });

        await test.step('Navigate to Care Discounts and check for Complimentary Evaluation button', async () => {
        try {
          await page.getByRole('link', { name: ' Care Discounts' }).click();
          await expect(page.getByRole('link', { name: 'Request A Complimentary' })).toBeVisible();
          reporter.log({ module: stepName, step: 'Navigate to Care Discounts and check for Complimentary Evaluation button', status: 'PASS', message: 'PASS' });
        } catch (e) {
          reporter.log({ module: stepName, step: 'Navigate to Care Discounts and check for Complimentary Evaluation button', status: 'FAIL', message: toMsg(e) });
          throw e;
        }
        try {
          const buttonLink = page.getByRole('link', { name: 'Request A Complimentary' });
          await test.step('Check for Request for Complimentary Evaluation button', async () => {
           // reporter.log({ module: stepName, step: 'Check for Login Button', status: 'INFO', message: 'START' });
            try {
              try {
                await expect(buttonLink).toBeVisible({ timeout: 5000 });
                buttonVisible = 'YES';
                } catch {
                  buttonVisible = 'NO';
                }
              
           if (buttonVisible === 'YES') {
            reporter.log({ module: stepName, step: 'Check for Request for Complimentary Evaluation button', status: 'PASS', message: 'PASS' });
           } else {
            reporter.log({ module: stepName, step: 'Check for Request for Complimentary Evaluation button', status: 'FAIL', message: 'Button not visible' });
          }
            } catch (e) {
              reporter.log({ module: stepName, step: 'Check for Request for Complimentary Evaluation button', status: 'FAIL', message: toMsg(e) });
              throw e;
            }

          });
        
        await page.screenshot({ path: screenshotPath, fullPage: true });
        screenshotTaken = 'YES';
      
       
      if (buttonVisible === 'YES') {
        //await page.screenshot({ path: screenshotPath, fullPage: true });
        await test.step('Click link and verify URL', async () => {
        try {
            await buttonLink.click();
              try {
                  await expect(page).toHaveURL(/concierge\/$/);
                  buttonRedirect = 'YES';
                  reporter.log({ module: stepName, step: 'Click link and verify URL', status: 'PASS', message: 'PASS' });
              } catch {
                  buttonRedirect = 'NO';
                  reporter.log({ module: stepName, step: 'Click link and verify URL', status: 'FAIL', message: 'Redirect URL did not match' });
                }
        } catch (e) 
          {
            reporter.log({ module: stepName, step: 'Click link and verify URL', status: 'FAIL', message: toMsg(e) });
            throw e;
          }
            });
          }

        } catch (e) {
          buttonVisible = 'NO';
          buttonRedirect = 'NO';
        }
        });  
           await test.step('Check all links on the page', async () => {
             const links = [
              'careNavigation',
              'onlineLegalBenefits',
              'careDiscounts',
              'claimsAssistance',
              'maximizeBenefits',
              'adviceAndCounseling'
              ];

              for (const anchor of links) {
                try {
                  await page.goto(`https://ltcrplus.com/your-family-member-needs-care/#${anchor}`);
                  await expect.soft(page).toHaveURL(`https://ltcrplus.com/family-benefits/#${anchor}`);
                  reporter.log({ module: stepName, step: `Check REDIRECT link for ${anchor}`, status: 'PASS', message: 'PASS' });
                } catch (e) {
                  reporter.log({ module: stepName, step: `Check REDIRECT link for ${anchor}`, status: 'FAIL', message: toMsg(e) });
                }
              }
           });
      });
    } catch (e) {
      screenshotTaken = 'NO';
    }
      console.log([`Result for ${row.URL}: ${screenshotTaken}`, `Screenshot: ${screenshotPath}`].join(' | '));
  }
  
});


test.only('Partner pages checks NEW', async ({ page }) => {
  const reporter = new RunReporter();
  reporter.log({
  module: 'Check if Request for Complimentary Evaluation section is present',
  step: ' ',
  status: 'INFO',
  message: 'START'
});

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



  for (const row of rows) {
    if (!row.URL) continue;
    let hostPart = '';
    try { hostPart = new URL(row.URL).hostname.replace(/^www\./, ''); } catch {}
    const fileStem = sanitizeForFilename(hostPart || 'url');
    const screenshotPath = path.join(screenshotDir, `${fileStem}.png`);

    let buttonVisible: 'YES' | 'NO' = 'NO';
    let buttonRedirect: 'YES' | 'NO' = 'NO';
    let screenshotTaken: 'YES' | 'NO' = 'NO';
    let errorMessage = '';
    const stepName = row.Name?.trim() || row.URL;

    try {
      await test.step(stepName, async () => {
        await page.goto(row.URL, { waitUntil: 'domcontentloaded' });
        
        

         await test.step('Navigate through Family Care Concierge Benefits', async () => {
        try {
          await page.getByRole('link', { name: 'Family Care Concierge Benefits' }).click();
          await expect(page).toHaveURL(/family-benefits\/$/);
          await page.goto(row.URL, { waitUntil: 'domcontentloaded' });
          reporter.log({ module: stepName, step: 'Navigate through Family Care Concierge Benefits', status: 'PASS', message: 'PASS' });
        } catch (e) {
          reporter.log({ module: stepName, step: 'Navigate through Family Care Concierge Benefits', status: 'FAIL', message: toMsg(e) });
          throw e;
        }
        });

        await test.step('Navigate through Multiple Carriers', async () => {
        try {
          await page.getByRole('link', { name: 'R Multiple carriers - shop' }).click();
          await expect(page).toHaveURL(/members-advantage\/#multipleCarriers$/);
          await page.goto(row.URL, { waitUntil: 'domcontentloaded' });
          reporter.log({ module: stepName, step: 'Navigate through Multiple Carriers', status: 'PASS', message: 'PASS' });
        } catch (e) {
          reporter.log({ module: stepName, step: 'Navigate through Multiple Carriers', status: 'FAIL', message: toMsg(e) });
          throw e;
        }
        });

        await test.step('Navigate through Multiple Product', async () => {
        try {
          await page.getByRole('link', { name: 'R Multiple Product Types -' }).click();
          await expect(page).toHaveURL(/members-advantage\/#multipleProduct$/);
          await page.goto(row.URL, { waitUntil: 'domcontentloaded' });
          reporter.log({ module: stepName, step: 'Navigate through Multiple Product', status: 'PASS', message: 'PASS' });
        } catch (e) {
          reporter.log({ module: stepName, step: 'Navigate through Multiple Product', status: 'FAIL', message: toMsg(e) });
          throw e;
        }
        });

        await test.step('Navigate through Exclusive Group Discounts', async () => {
        try {
          await page.getByRole('link', { name: 'R Exclusive Group Discounts' }).click();
          await expect(page).toHaveURL(/members-advantage\/#exclusiveGroupDiscounts$/);
          await page.goto(row.URL, { waitUntil: 'domcontentloaded' });
          reporter.log({ module: stepName, step: 'Navigate through Exclusive Group Discounts', status: 'PASS', message: 'PASS' });
        } catch (e) {
          reporter.log({ module: stepName, step: 'Navigate through Exclusive Group Discounts', status: 'FAIL', message: toMsg(e) });
          throw e;
        }
        });
         
        await test.step('Navigate through Underwriting', async () => {
        try {
         await page.getByRole('link', { name: 'R Underwriting /Age' }).click();
          await expect(page).toHaveURL(/members-advantage\/#underwriting$/);
          await page.goto(row.URL, { waitUntil: 'domcontentloaded' });
          reporter.log({ module: stepName, step: 'Navigate through Underwriting', status: 'PASS', message: 'PASS' });
        } catch (e) {
          reporter.log({ module: stepName, step: 'Navigate through Underwriting', status: 'FAIL', message: toMsg(e) });
          throw e;
        }
        });

        await test.step('Navigate through Lifetime Advocacy - Support', async () => {
        try {
          await page.getByRole('link', { name: 'R Lifetime Advocacy - Support' }).click();
          await expect(page).toHaveURL(/members-advantage\/#lifetimeAdvocacy$/);
          await page.goto(row.URL, { waitUntil: 'domcontentloaded' });
          reporter.log({ module: stepName, step: 'Lifetime Advocacy - Support', status: 'PASS', message: 'PASS' });
        } catch (e) {
          reporter.log({ module: stepName, step: 'Lifetime Advocacy - Support', status: 'FAIL', message: toMsg(e) });
          throw e;
        }
        });

        await test.step('Navigate through LTC Funding Research', async () => {
        try {
          await page.getByRole('link', { name: 'R LTC Funding Research' }).click();
          await expect(page).toHaveURL(/members-advantage\/#ltcFundingResearch$/);
          await expect(page.getByText('To speak to a LTC Funding')).toBeVisible();

          await test.step('Check for Contact Us link', async () => {
            try {
              await page.getByRole('link', { name: 'Click here for more' }).click();
              await expect(page).toHaveURL('https://advisors.ltcr.com/');
            } catch (e) {
              reporter.log({ module: stepName, step: 'Check for Contact Us link', status: 'FAIL', message: toMsg(e) });
              throw e;
            }
          });
          await page.goto(row.URL, { waitUntil: 'domcontentloaded' });
          reporter.log({ module: stepName, step: 'LTC Funding Research', status: 'PASS', message: 'PASS' });
        } catch (e) {
          reporter.log({ module: stepName, step: 'LTC Funding Research', status: 'FAIL', message: toMsg(e) });
          throw e;
        }
        });

        await test.step('Navigate through Members / Consumers', async () => {
        try {
          const page1Promise = page.waitForEvent('popup');
          await page.getByRole('link', { name: 'Members / Consumers' }).click();
          const page1 = await page1Promise;
          await expect(page1).toHaveURL('https://ltcrplus.com/members-consumers/');
          await page1.close();
          await page.goto(row.URL, { waitUntil: 'domcontentloaded' });
          reporter.log({ module: stepName, step: 'Members / Consumers', status: 'PASS', message: 'PASS' });
        } catch (e) {
          reporter.log({ module: stepName, step: 'Members / Consumers', status: 'FAIL', message: toMsg(e) });
          throw e;
        }
        });
        
        await test.step('Navigate through Agents / Advisers', async () => {
          try {
          const page1Promise = page.waitForEvent('popup');
          await page.getByRole('link', { name: 'Agents/Advisors' }).click();
          const page1 = await page1Promise;
          await expect(page1).toHaveURL('https://ltcrplus.com/agents-advisors/');
          await page1.close();
          await page.goto(row.URL, { waitUntil: 'domcontentloaded' });
          reporter.log({ module: stepName, step: 'Agents / Advisers', status: 'PASS', message: 'PASS' });
        } catch (e) {
          reporter.log({ module: stepName, step: 'Agents / Advisers', status: 'FAIL', message: toMsg(e) });
          throw e;
        }
        });

        await test.step('Navigate through Affinity Groups / Financial Institutions', async () => {
          try {
          const page1Promise = page.waitForEvent('popup');
          await page.getByRole('link', { name: 'Affinity Groups/Financial Institutions' }).click();
          const page1 = await page1Promise;
          await expect(page1).toHaveURL('https://ltcrplus.com/affinity-groups-financial-institutions/', { timeout: 10000 });
          await page1.close();
          await page.goto(row.URL, { waitUntil: 'domcontentloaded' });
          reporter.log({ module: stepName, step: 'Affinity Groups / Financial Institutions', status: 'PASS', message: 'PASS' });
        } catch (e) {
          reporter.log({ module: stepName, step: 'Affinity Groups / Financial Institutions', status: 'FAIL', message: toMsg(e) });
          throw e;
        }
        });


        await test.step('Navigate through Advice and Counseling', async () => {
        try {
          await page.getByRole('link', { name: ' Advice & Counseling' }).click();
          await expect(page).toHaveURL(/family-benefits\/#adviceAndCounseling$/);
          await page.goto(row.URL, { waitUntil: 'domcontentloaded' });
          reporter.log({ module: stepName, step: 'Navigate through Advice and Counseling', status: 'PASS', message: 'PASS' });
        } catch (e) {
          reporter.log({ module: stepName, step: 'Navigate through Advice and Counseling', status: 'FAIL', message: toMsg(e) });
          throw e;
        }
        });
        
        await test.step('Navigate through Care Navigation', async () => {
        try {
          await page.getByRole('link', { name: ' Care Navigation' }).click();
          await expect(page).toHaveURL(/family-benefits\/#careNavigation$/);
          await page.goto(row.URL, { waitUntil: 'domcontentloaded' });
          reporter.log({ module: stepName, step: 'Navigate through Care Navigation', status: 'PASS', message: 'PASS' });
        } catch (e) {
          reporter.log({ module: stepName, step: 'Navigate through Care Navigation', status: 'FAIL', message: toMsg(e) });
          throw e;
        }
        });

        await test.step('Navigate through Claims Assistance', async () => {
        try {
          await page.getByRole('link', { name: ' Claims Assistance' }).click();
          await expect(page).toHaveURL(/family-benefits\/#claimsAssistance$/);
          await page.goto(row.URL, { waitUntil: 'domcontentloaded' });
          reporter.log({ module: stepName, step: 'Navigate through Claims Assistance', status: 'PASS', message: 'PASS' });
        } catch (e) {
          reporter.log({ module: stepName, step: 'Navigate through Claims Assistance', status: 'FAIL', message: toMsg(e) });
          throw e;
        }
        });

        await test.step('Navigate through Maximize Benefits', async () => {
        try {
          await page.getByRole('link', { name: ' Maximize Benefits' }).click();
          await expect(page).toHaveURL(/family-benefits\/#maximizeBenefits$/);
          await page.goto(row.URL, { waitUntil: 'domcontentloaded' });
          reporter.log({ module: stepName, step: 'Navigate through Maximize Benefits', status: 'PASS', message: 'PASS' });
        } catch (e) {
          reporter.log({ module: stepName, step: 'Navigate through Maximize Benefits', status: 'FAIL', message: toMsg(e) });
          throw e;
        }
        });

        await test.step('Navigate through Online Legal Benefits', async () => {
        try {
          await page.getByRole('link', { name: ' Online Legal Benefits' }).click();
          await expect(page).toHaveURL(/family-benefits\/#onlineLegalBenefits$/);
          await page.goto(row.URL, { waitUntil: 'domcontentloaded' });
          reporter.log({ module: stepName, step: 'Navigate through Online Legal Benefits', status: 'PASS', message: 'PASS' });
        } catch (e) {
          reporter.log({ module: stepName, step: 'Navigate through Online Legal Benefits', status: 'FAIL', message: toMsg(e) });
          throw e;
        }
        });

        await test.step('Navigate through Contact Us', async () => {
        try {
          await page.getByRole('link', { name: 'Contact Us' }).click();
          await expect(page).toHaveURL(/contact-us\/$/);
          await page.goto(row.URL, { waitUntil: 'domcontentloaded' });
          reporter.log({ module: stepName, step: 'Navigate through Contact Us', status: 'PASS', message: 'PASS' });
        } catch (e) {
          reporter.log({ module: stepName, step: 'Navigate through Contact Us', status: 'FAIL', message: toMsg(e) });
          throw e;
        }
        });

          //sdgsddfsgsd
        await test.step('Navigate through NEW LOGIN/SIGNUP Button', async () => {
        try {
          //await page.getByRole('link', { name: 'Login' }).click();
          await expect(page.getByRole('link', { name: 'Legal Benefit Access' })).toBeVisible();
          await page.getByRole('link', { name: 'Legal Benefit Access' }).click();
          //await expect(page).toHaveURL(/family-benefits\/#onlineLegalBenefits$/);
          await expect(page.locator('#onlineLegalBenefits')).toBeVisible();
          await expect(page.getByRole('heading', { name: 'Information Request' })).toBeVisible();
          await page.goto(row.URL, { waitUntil: 'domcontentloaded' });
          reporter.log({ module: stepName, step: 'Navigate through NEW LOGIN/SIGNUP Button', status: 'PASS', message: 'PASS' });
        } catch (e) {
          reporter.log({ module: stepName, step: 'Navigate through NEW LOGIN/SIGNUP Button', status: 'FAIL', message: toMsg(e) });
          throw e;
        }
        });

        await test.step('Navigate to Care Discounts and check for Complimentary Evaluation button', async () => {
        try {
          await page.getByRole('link', { name: ' Care Discounts' }).click();
          await expect(page.getByRole('link', { name: 'Request A Complimentary' })).toBeVisible();
          reporter.log({ module: stepName, step: 'Navigate to Care Discounts and check for Complimentary Evaluation button', status: 'PASS', message: 'PASS' });
        } catch (e) {
          reporter.log({ module: stepName, step: 'Navigate to Care Discounts and check for Complimentary Evaluation button', status: 'FAIL', message: toMsg(e) });
          throw e;
        }
        try {
          const buttonLink = page.getByRole('link', { name: 'Request A Complimentary' });
          await test.step('Check for Request for Complimentary Evaluation button', async () => {
           // reporter.log({ module: stepName, step: 'Check for Login Button', status: 'INFO', message: 'START' });
            try {
              try {
                await expect(buttonLink).toBeVisible({ timeout: 5000 });
                buttonVisible = 'YES';
                } catch {
                  buttonVisible = 'NO';
                }
              
           if (buttonVisible === 'YES') {
            reporter.log({ module: stepName, step: 'Check for Request for Complimentary Evaluation button', status: 'PASS', message: 'PASS' });
           } else {
            reporter.log({ module: stepName, step: 'Check for Request for Complimentary Evaluation button', status: 'FAIL', message: 'Button not visible' });
          }
            } catch (e) {
              reporter.log({ module: stepName, step: 'Check for Request for Complimentary Evaluation button', status: 'FAIL', message: toMsg(e) });
              throw e;
            }

          });
        
        await page.screenshot({ path: screenshotPath, fullPage: true });
        screenshotTaken = 'YES';
      
       
      if (buttonVisible === 'YES') {
        //await page.screenshot({ path: screenshotPath, fullPage: true });
        await test.step('Click link and verify URL', async () => {
        try {
            await buttonLink.click();
              try {
                  await expect(page).toHaveURL(/concierge\/$/);
                  buttonRedirect = 'YES';
                  reporter.log({ module: stepName, step: 'Click link and verify URL', status: 'PASS', message: 'PASS' });
              } catch {
                  buttonRedirect = 'NO';
                  reporter.log({ module: stepName, step: 'Click link and verify URL', status: 'FAIL', message: 'Redirect URL did not match' });
                }
        } catch (e) 
          {
            reporter.log({ module: stepName, step: 'Click link and verify URL', status: 'FAIL', message: toMsg(e) });
            throw e;
          }
            });
          }

        } catch (e) {
          buttonVisible = 'NO';
          buttonRedirect = 'NO';
        }
        });  
           
      });
    } catch (e) {
      screenshotTaken = 'NO';
    }
      console.log([`Result for ${row.URL}: ${screenshotTaken}`, `Screenshot: ${screenshotPath}`].join(' | '));
  }
  
});

