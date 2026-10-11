import { defineConfig } from "astro/config";
import svelte from "@astrojs/svelte";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  integrations: [svelte(), sitemap()],
  site: process.env.PUBLIC_SITE_URL ?? "https://www.sagraph.top",
  output: "static",
});
