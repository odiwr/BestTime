import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm"],
    dts: true,
    clean: true,
    sourcemap: true,
    target: "es2022",
    // Bundled rather than left as an import, because the whole point of this
    // package is that one file is the whole thing.
    noExternal: ["@besttime/core"],
  },
  {
    // The script-tag build. No modules, no import map, no build step for the
    // person embedding it — which is most of them.
    // Named without the suffix: tsup appends `.global` for the IIFE format.
    entry: { besttime: "src/index.ts" },
    format: ["iife"],
    globalName: "BestTime",
    dts: false,
    clean: false,
    minify: true,
    sourcemap: true,
    target: "es2022",
    noExternal: ["@besttime/core"],
  },
]);
