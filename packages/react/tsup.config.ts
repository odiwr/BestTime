import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.tsx"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "es2022",
  external: ["react", "besttime", "@besttime/core"],
  // Preserved, because this is what tells a bundler the component may not be
  // rendered on a server.
  banner: { js: '"use client";' },
});
