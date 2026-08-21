import { defineConfig } from "astro/config";
import svelte from "@astrojs/svelte";

export default defineConfig({
  integrations: [svelte()],
  site: process.env.PUBLIC_SITE_URL ?? "https://www.sagraph.top",
  output: "static",
});
