import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '../tests',
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  reporter: 'list',
  use: {
    baseURL: 'https://usta.courtreserve.com/Online/Portal/Index/5881',
    headless: true,
    viewport: { width: 1500, height: 900 },
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
