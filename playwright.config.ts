// Browser tests setup: runs the editor tests on a production build, or the smoke test on SMOKE_URL.
import { defineConfig } from "@playwright/test";

const smokeUrl = process.env.SMOKE_URL;
const room = process.env.NEXT_PUBLIC_LIVEBLOCKS_ROOM_ID || "e2e-tests";

// the editor tests press Reset, so they must never run on the real canvas
if (room === "my-room") {
  throw new Error("The editor tests can't run on the production room");
}

const PORT = 3100;

export default defineConfig({
  testDir: "e2e",
  testMatch: smokeUrl ? "smoke.spec.ts" : "editor.spec.ts",
  // the tests share one Liveblocks room, so they can't run at the same time
  workers: 1,
  fullyParallel: false,
  timeout: 45_000,
  // a reload right after a change can lose it in Liveblocks, see the persistence test
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: smokeUrl || `http://localhost:${PORT}`,
    viewport: { width: 1400, height: 850 },
    trace: "retain-on-failure",
  },
  webServer: smokeUrl
    ? undefined
    : {
        command: `npm run build && npx next start -p ${PORT}`,
        port: PORT,
        timeout: 240_000,
        reuseExistingServer: false,
        env: { NEXT_PUBLIC_LIVEBLOCKS_ROOM_ID: room },
      },
});
