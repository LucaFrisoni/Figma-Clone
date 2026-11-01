// Test runner setup: unit tests run in a simulated browser with the same "@" imports as the app.
import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "happy-dom",
    include: ["src/**/*.test.ts"],
    setupFiles: ["src/lib/test-setup.ts"],
  },
});
