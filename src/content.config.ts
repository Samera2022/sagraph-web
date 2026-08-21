import { defineCollection, z } from "astro:content";

const changelog = defineCollection({
  type: "data",
  schema: z.object({
    version: z.string(),
    date: z.string(),
    title: z.string(),
    summary: z.string(),
    highlights: z.array(z.string()),
  }),
});

export const collections = { changelog };
