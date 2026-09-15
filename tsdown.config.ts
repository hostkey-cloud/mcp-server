import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  outDir: "dist",
  clean: true,
  minify: false,
  banner: { js: "#!/usr/bin/env node" },
});
