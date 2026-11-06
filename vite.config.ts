import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: {
    // This repo lives on /mnt/c under WSL, where file-change events from Windows editors often
    // never reach Linux, so hot reload has to poll instead.
    watch: { usePolling: true, interval: 300 },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
