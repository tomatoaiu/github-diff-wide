import { defineConfig } from "wxt"

export default defineConfig({
  srcDir: "src",
  manifestVersion: 3,
  manifest: {
    name: "GitHub Diff Wide",
    description:
      "Use the full diff width for newly added files in GitHub pull request split view.",
  },
})
