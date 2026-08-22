<script lang="ts">
  import { onMount } from "svelte";

  interface Download {
    kind: string;
    label: string;
    filename: string;
    artifact: string;
    size?: number;
  }

  interface Platform {
    artifact: string;
    downloads?: Download[];
  }

  interface PlatformEntry {
    arch: string;
    platform: Platform;
  }

  interface Release {
    version: string;
    channel: string;
    published: boolean;
    pub_date: string;
    platforms: Record<string, Platform>;
  }

  interface Catalog {
    releases: Release[];
  }

  const apiBase = import.meta.env.PUBLIC_API_BASE_URL ?? (import.meta.env.DEV ? "http://127.0.0.1:8787" : "https://api.sagraph.top");
  const downloadBase = import.meta.env.PUBLIC_DOWNLOAD_BASE_URL ?? "https://download.sagraph.top";
  const platformOrder = [
    { target: "windows", name: "Windows", detail: "Windows 10/11", symbol: "W" },
    { target: "linux", name: "Linux", detail: "Desktop packages", symbol: "L" },
    { target: "darwin", name: "macOS", detail: "Available architectures shown below", symbol: "M" },
  ];

  let release: Release | null = null;
  let loading = true;
  let error = "";

  onMount(async () => {
    try {
      const response = await fetch(`${apiBase}/api/v1/releases/catalog`);
      if (!response.ok) throw new Error(`catalog request failed: ${response.status}`);
      const catalog = (await response.json()) as Catalog;
      release = catalog.releases
        .filter((entry) => entry.published && entry.channel === "stable")
        .sort((left, right) => compareVersions(right.version, left.version))[0] ?? null;
      if (!release) error = "No published release is available yet.";
    } catch {
      error = "Release downloads are temporarily unavailable.";
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

  function entriesFor(target: string): PlatformEntry[] {
    if (!release) return [];
    return Object.entries(release.platforms)
      .filter(([key]) => key.startsWith(`${target}-`))
      .map(([key, platform]) => ({ arch: key.slice(target.length + 1), platform }));
  }

  function downloadUrl(artifact: string): string {
    const relative = artifact.replace(/^releases\//, "");
    return `${downloadBase}/api/v1/releases/${relative.split("/").map(encodeURIComponent).join("/")}`;
  }

  function formatSize(size?: number): string {
    if (!size) return "";
    const units = ["B", "KB", "MB", "GB"];
    let value = size;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
      value /= 1024;
      unit += 1;
    }
    return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
  }
</script>

{#if loading}
  <p class="status card">Loading release downloads…</p>
{:else if error}
  <p class="status card">{error}</p>
{:else if release}
  <div class="release-meta">
    <span>Latest stable release</span>
    <strong>v{release.version}</strong>
  </div>
  <div class="platform-grid">
    {#each platformOrder as platform}
      {@const entries = entriesFor(platform.target)}
      {@const downloads = entries.flatMap((entry) => entry.platform.downloads ?? [])}
      <article class="card platform" class:unavailable={downloads.length === 0}>
        <div>
          <span class="platform-symbol">{platform.symbol}</span>
          <h2>{platform.name}</h2>
          <p class="platform-detail">{platform.detail}</p>
        </div>
        {#if downloads.length > 0}
          {#each entries as entry}
            {@const entryDownloads = entry.platform.downloads ?? []}
            <h3>{entry.arch}</h3>
            <ul class="download-list">
              {#each entryDownloads as download}
                <li>
                  <a class="download-link" href={downloadUrl(download.artifact)}>
                    <span>
                      <strong>{download.label}</strong>
                      <small>{download.filename}{download.size ? ` · ${formatSize(download.size)}` : ""}</small>
                    </span>
                    <span aria-hidden="true">↓</span>
                  </a>
                </li>
              {/each}
            </ul>
          {/each}
        {:else}
          <p class="unavailable-copy">No package is published for this platform yet.</p>
        {/if}
      </article>
    {/each}
  </div>
{/if}

<style>
  .status { color: var(--muted); margin-top: 4rem; padding: 1.4rem; }
  .release-meta { align-items: center; color: var(--muted); display: flex; gap: 0.8rem; margin-top: 4rem; }
  .release-meta strong { color: var(--text); font-size: 1.1rem; }
  .platform-grid { display: grid; gap: 1rem; grid-template-columns: repeat(3, 1fr); margin-top: 1rem; }
  .platform { min-height: 350px; padding: 1.6rem; }
  .platform.unavailable { opacity: 0.65; }
  .platform-symbol { align-items: center; background: var(--panel-soft); border-radius: 12px; color: var(--accent); display: inline-flex; font-weight: 800; height: 38px; justify-content: center; width: 38px; }
  .platform h2 { margin: 1.8rem 0 0.4rem; }
  .platform-detail, .unavailable-copy { color: var(--muted); font-size: 0.85rem; }
  .platform h3 { color: var(--cyan); font-size: 0.72rem; letter-spacing: 0.1em; margin: 2rem 0 0.2rem; text-transform: uppercase; }
  .download-list { list-style: none; margin: 2rem 0 0; padding: 0; }
  .download-list li + li { border-top: 1px solid var(--line); }
  .download-link { align-items: center; display: flex; gap: 1rem; justify-content: space-between; padding: 0.95rem 0; }
  .download-link:hover strong { color: var(--cyan); }
  .download-link strong, .download-link small { display: block; }
  .download-link strong { font-size: 0.88rem; transition: color 0.2s ease; }
  .download-link small { color: var(--muted); font-size: 0.68rem; margin-top: 0.3rem; overflow-wrap: anywhere; }
  .download-link > span:last-child { color: var(--accent); font-size: 1.2rem; }
  @media (max-width: 800px) { .platform-grid { grid-template-columns: 1fr; } }
</style>
