<script lang="ts">
  import { onMount } from "svelte";

  interface FallbackEntry {
    version: string;
    date: string;
    title: string;
    summary: string;
    highlights: string[];
  }

  interface Release {
    version: string;
    channel: string;
    published: boolean;
    pub_date: string;
    notes: string;
  }

  interface Catalog {
    releases: Release[];
  }

  interface Props {
    fallbackEntries: FallbackEntry[];
  }

  let { fallbackEntries }: Props = $props();

  const apiBase = import.meta.env.PUBLIC_API_BASE_URL ?? (import.meta.env.DEV ? "http://127.0.0.1:8787" : "https://api.sagraph.top");
  let entries = $state<Release[]>([]);
  let loading = $state(true);
  let remoteError = $state(false);

  onMount(async () => {
    try {
      const response = await fetch(`${apiBase}/api/v1/releases/catalog`);
      if (!response.ok) throw new Error(`catalog request failed: ${response.status}`);
      const catalog = (await response.json()) as Catalog;
      entries = catalog.releases
        .filter((release) => release.published && release.channel === "stable" && release.notes.trim())
        .sort((left, right) => compareVersions(right.version, left.version));
      if (entries.length === 0) remoteError = true;
    } catch {
      remoteError = true;
    } finally {
      loading = false;
    }
  });

  function compareVersions(left: string, right: string): number {
    const parse = (version: string) => version.replace(/^v/, "").split("-")[0].split(".").map(Number);
    const leftParts = parse(left);
    const rightParts = parse(right);
    for (let index = 0; index < 3; index += 1) {
      const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
      if (difference !== 0) return difference;
    }
    return 0;
  }

  function formatDate(value: string): string {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date);
  }

  function fallbackAsRelease(entry: FallbackEntry): Release {
    return {
      version: entry.version,
      channel: "stable",
      published: true,
      pub_date: entry.date,
      notes: [`## ${entry.title}`, entry.summary, ...entry.highlights.map((highlight) => `- ${highlight}`)].join("\n\n"),
    };
  }

  function blocks(notes: string): Array<{ type: "heading" | "bullet" | "paragraph"; text: string }> {
    return notes
      .split(/\r?\n/)
      .map((line) => line.trim())
      .reduce<Array<{ type: "heading" | "bullet" | "paragraph"; text: string }>>((result, line) => {
        if (!line) return result;
        if (line.startsWith("## ")) result.push({ type: "heading", text: line.slice(3) });
        else if (line.startsWith("- ")) result.push({ type: "bullet", text: line.slice(2) });
        else result.push({ type: "paragraph", text: line });
        return result;
      }, []);
  }
</script>

{#if loading}
  <p class="status card">Loading release notes…</p>
{:else}
  {#if remoteError}
    <p class="status card">Live release notes are temporarily unavailable. Showing the notes bundled with this site.</p>
  {/if}
  {@const visibleEntries = entries.length > 0 ? entries : fallbackEntries.map(fallbackAsRelease)}
  <div class="entries">
    {#each visibleEntries as entry (entry.version)}
      <article class="entry">
        <div class="entry-meta">
          <strong>v{entry.version}</strong>
          <time datetime={entry.pub_date}>{formatDate(entry.pub_date)}</time>
        </div>
        <div class="entry-content">
          {#each blocks(entry.notes) as block}
            {#if block.type === "heading"}
              <h2>{block.text}</h2>
            {:else if block.type === "bullet"}
              <ul><li>{block.text}</li></ul>
            {:else}
              <p>{block.text}</p>
            {/if}
          {/each}
        </div>
      </article>
    {/each}
  </div>
{/if}

<style>
  .status { color: var(--muted); margin-top: 3rem; padding: 1.2rem; }
  .entries { border-top: 1px solid var(--line); margin-top: 5rem; }
  .entry { display: grid; gap: 3rem; grid-template-columns: 150px 1fr; padding: 2.6rem 0; border-bottom: 1px solid var(--line); }
  .entry-meta { display: flex; flex-direction: column; gap: 0.45rem; }
  .entry-meta strong { color: var(--accent); font-size: 1.1rem; }
  .entry-meta time { color: var(--muted); font-size: 0.78rem; }
  .entry-content { display: grid; gap: 0.9rem; }
  .entry-content h2 { font-size: 1.5rem; margin: 0; }
  .entry-content p, .entry-content li { color: var(--muted); line-height: 1.7; margin: 0; }
  .entry-content ul { margin: 0; padding-left: 1.2rem; }
  @media (max-width: 600px) { .entry { gap: 1rem; grid-template-columns: 1fr; } }
</style>
