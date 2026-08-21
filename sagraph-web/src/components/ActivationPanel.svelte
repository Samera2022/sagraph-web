<script lang="ts">
  const apiBase = "https://api.sagraph.top";
  let orderId = $state("");
  let machineCode = $state("");
  let activationKey = $state("");
  let message = $state("Use the PayPal order ID from your receipt.");
  let busy = $state(false);

  async function activate() {
    busy = true;
    activationKey = "";
    message = "Verifying payment…";
    try {
      const response = await fetch(`${apiBase}/api/v1/licenses/activate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ order_id: orderId.trim(), machine_code: machineCode.trim().toUpperCase() }),
      });
      const data = await response.json() as { activation_key?: string; error?: string };
      if (!response.ok || !data.activation_key) throw new Error(data.error ?? `HTTP ${response.status}`);
      activationKey = data.activation_key;
      message = "Activation key generated. Copy it into saGraph Settings.";
    } catch (error) {
      message = `Unable to generate key: ${String(error)}`;
    } finally { busy = false; }
  }

  async function copyActivation() {
    await navigator.clipboard.writeText(activationKey);
    message = "Activation key copied.";
  }
</script>

<div class="card activation-card">
  <label for="order-id">PayPal order ID</label>
  <input id="order-id" bind:value={orderId} placeholder="Example: 5O190127TN364715T" autocomplete="off" />
  <label for="machine-code">saGraph machine code</label>
  <input id="machine-code" bind:value={machineCode} placeholder="SAG-XXXXXXXXXXXX" autocomplete="off" spellcheck="false" />
  <button class="button button-primary" disabled={busy} onclick={activate}>{busy ? "Verifying…" : "Generate activation key"}</button>
  <p class="status" aria-live="polite">{message}</p>
  {#if activationKey}
    <textarea readonly value={activationKey}></textarea>
    <button class="button button-ghost" onclick={copyActivation}>Copy activation key</button>
  {/if}
</div>

<style>
  .activation-card { display: flex; flex-direction: column; gap: 0.7rem; margin-top: 3rem; max-width: 680px; padding: 1.5rem; }
  label { font-size: 0.82rem; font-weight: 700; margin-top: 0.5rem; }
  input, textarea { background: var(--panel-soft); border: 1px solid var(--line); border-radius: 12px; color: var(--text); font: inherit; outline: none; padding: 0.9rem 1rem; width: 100%; }
  input:focus, textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(154, 140, 255, 0.12); }
  textarea { min-height: 120px; resize: vertical; }.button { align-self: flex-start; cursor: pointer; margin-top: 0.7rem; }.button:disabled { cursor: wait; opacity: 0.6; }
  .status { color: var(--muted); font-size: 0.82rem; line-height: 1.6; min-height: 1.4rem; }
</style>
