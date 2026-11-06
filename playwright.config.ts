import { defineConfig } from '@playwright/test';

const PORT = 5199;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1, // the fake mic plays in real time, so parallel runs only add timing noise
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1000, height: 620 },
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
  },
});
