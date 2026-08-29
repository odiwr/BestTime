import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.ts"],
    // The core is pure functions and needs no DOM. The element package brings
    // its own environment where it needs one.
    environment: "node",
    coverage: {
      include: ["packages/core/src/**"],
      reporter: ["text", "lcov"],
    },
  },
});
