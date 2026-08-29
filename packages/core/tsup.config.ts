import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  // Both, because the core is meant to run in Node as well as the browser —
  // generating a timeline at build time or validating a sheet in CI are the
  // whole reason it has no DOM in it.
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "es2022",
});
