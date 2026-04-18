/// <reference types="node" />

import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { TIMEOUT } from 'dns';
import { log } from 'console';
const { RunReporter } = require('./reporter');
const toMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

const reporter = new RunReporter();

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


     const buttonsUP = [
    {
        //type: 'link',
        name: 'Family Care Concierge Benefits',
        url: /family-benefits\/$/,
        log: 'Navigate through Family Care Concierge Benefits'
    },
    {
        //type: 'link',
        name: 'R Multiple carriers - shop',
        url: /members-advantage\/#multipleCarriers$/,
        log: 'Navigate through Multiple carriers - shop'
    },
    {
       // type: 'link',
        name: 'R Multiple Product Types -',
        url: /members-advantage\/#multipleProduct$/,
        log: 'Navigate through Multiple Product Types -'
    },
    {
       // type: 'link',
        name: 'R Exclusive Group Discounts',
        url: /members-advantage\/#exclusiveGroupDiscounts$/,
        log: 'Navigate through Exclusive Group Discounts'
    },
    {
       // type: 'link',
        name: 'R Underwriting /Age',
        url: /members-advantage\/#underwriting$/,
        log: 'Navigate through Underwriting'
    },
    {
        //type: 'link',
        name: 'R Lifetime Advocacy - Support',
        url: /members-advantage\/#lifetimeAdvocacy$/,
        log: 'Navigate through Lifetime Advocacy - Support'
    },
    {
        //type: 'link',
        name: 'R LTC Funding Research',
        url: /members-advantage\/#ltcFundingResearch$/,
        log: 'Navigate through LTC Funding Research'
    },
    {
        //type: 'link',
        name: ' Advice & Counseling',
        url: /family-benefits\/#adviceAndCounseling$/,
        log: 'Navigate through Advice & Counseling'
    },
    {
        //type: 'link',
        name: ' Care Navigation',
        url: /family-benefits\/#careNavigation$/,
        log: 'Navigate through Care Navigation'
    },
    {
        //type: 'link',
        name: ' Claims Assistance',
        url: /family-benefits\/#claimsAssistance$/,
        log: 'Navigate through Claims Assistance'
    },
    {
        //type: 'link',
        name: ' Maximize Benefits',
        url: /family-benefits\/#maximizeBenefits$/,  
        log: 'Navigate through Maximize Benefits'
    },
    {
        //type: 'link',
        name: ' Online Legal Benefits',
        url: /family-benefits\/#onlineLegalBenefits$/,
        log: 'Navigate through Online Legal Benefits'
    },
    {
        name: 'Legal Benefit Access',
        url: 'https://ltcrplus.com/members-consumers/',
        log: 'Navigate through Legal Benefit Access Button'
    }
    
    

   ];
    const newPageButton = [
     {
        //type: 'link',
        name: 'Members / Consumers',
        url: 'https://ltcrplus.com/members-consumers/',
        log: 'Navigate through Members / Consumers'
    },
    {
        //type: 'link',  
        name: 'Agents/Advisors',
        url: 'https://ltcrplus.com/agents-advisors/',
        log: 'Navigate through Agents/Advisors'
    },
    {
        //type: 'link',
        name: 'Affinity Groups/Financial Institutions',
        url: 'https://ltcrplus.com/affinity-groups-financial-institutions/',
        log: 'Navigate through Affinity Groups/Financial Institutions'
    },

   ];

test.only('Partner pages checks NEW', async ({ page }) => {
  test.setTimeout(0);
  reporter.log({
  module: 'Check if Request for Complimentary Evaluation section is present',
  step: ' ',
  status: 'INFO',
  message: 'START'
});

 
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


        for (const buttonName of buttonsUP) {
        await test.step(buttonName.log, async () => {
          try {
          const page1Promise = page;
          await page.getByRole('link', { name: buttonName.name }).click();
          const page1 = await page1Promise;
          await expect(page1).toHaveURL(buttonName.url, { timeout: 10000 });
          //await page1.close();
          //await page.waitForTimeout(5000);
          await page.goto(row.URL, { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(5000);
          reporter.log({ module: stepName, step: buttonName.log, status: 'PASS', message: 'PASS' });
          if (buttonName.name === ' Advice & Counseling') {
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
         await page.goto(row.URL, { waitUntil: 'domcontentloaded' });
  // end of if advice and counseling button
      

          }
        } catch (e) {
          reporter.log({ module: stepName, step: buttonName.log, status: 'FAIL', message: toMsg(e) });
          throw e;
        }
        });  
    }
    
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



        //await test.step('Navigate through NEW PAGE Buttons on Members/Consumers, Agents/Advisors, Affinity Groups pages', async () => {
        try {
          for (const newButton of newPageButton) {
                   await test.step(stepName, async () => {
                    try {
                      const page1Promise = page.waitForEvent('popup');  
                      await page.getByRole('link', { name: newButton.name }).click();
                      const page1 = await page1Promise;
                      await expect(page1).toHaveURL(newButton.url);
                      await page1.close();
                      await page.goto(row.URL, { waitUntil: 'domcontentloaded' });
                      reporter.log({ module: stepName, step: newButton.log, status: 'PASS', message: 'PASS' });
                    } catch (e) {
                      reporter.log({ module: stepName, step: newButton.log, status: 'FAIL', message: toMsg(e) });
                      throw e;
                    }
                    });
          }

          }catch (e) {
            reporter.log({ module: stepName, step: 'Navigate through NEW Buttons on Members/Consumers, Agents/Advisors, Affinity Groups pages', status: 'FAIL', message: toMsg(e) });
            throw e;
          }
      
  
           
      });
    } catch (e) {
      screenshotTaken = 'NO';
    }
      console.log([`Result for ${row.URL}: ${screenshotTaken}`, `Screenshot: ${screenshotPath}`].join(' | '));
  }






  
  
});

