<script lang="ts">
  import { onMount } from "svelte";

  interface Plan { id: string; label: string; amount: string; term: string; }
  interface PayPalNamespace {
    Buttons: (options: {
      style?: Record<string, string>;
      createOrder: () => Promise<string>;
      onApprove: (data: { orderID: string }) => Promise<void>;
      onCancel?: () => void;
      onError?: (error: unknown) => void;
    }) => { render: (target: string) => Promise<void>; close?: () => void };
  }

  const apiBase = "https://api.sagraph.top";
  let plans = $state<Plan[]>([]);
  let selectedPlan = $state("lifetime");
  let machineCode = $state("");
  let activationKey = $state("");
  let orderId = $state("");
  let message = $state("Loading PayPal…");
  let busy = $state(false);
  let paypal: PayPalNamespace | null = null;
  let buttons: ReturnType<PayPalNamespace["Buttons"]> | null = null;

  onMount(async () => {
    try {
      const response = await fetch(`${apiBase}/api/v1/paypal/config`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const config = await response.json() as { client_id: string; currency: string; plans: Plan[] };
      plans = config.plans;
      await loadPayPal(config.client_id, config.currency);
      message = "Enter the machine code shown in saGraph, then complete payment.";
      await renderButtons();
    } catch (error) {
      message = `Payment service unavailable: ${String(error)}`;
    }
  });

  async function loadPayPal(clientId: string, currency: string) {
    const existing = document.querySelector<HTMLScriptElement>("script[data-sagraph-paypal]");
    if (existing) {
      await new Promise<void>((resolve, reject) => {
        if ((window as Window & { paypal?: PayPalNamespace }).paypal) resolve();
        else { existing.addEventListener("load", () => resolve(), { once: true }); existing.addEventListener("error", () => reject(new Error("PayPal SDK failed to load")), { once: true }); }
      });
    } else {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.dataset.sagraphPaypal = "true";
        script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${encodeURIComponent(currency)}&intent=capture`;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("PayPal SDK failed to load"));
        document.head.appendChild(script);
      });
    }
    paypal = (window as Window & { paypal?: PayPalNamespace }).paypal ?? null;
    if (!paypal) throw new Error("PayPal SDK unavailable");
  }

  async function renderButtons() {
    if (!paypal) return;
    await buttons?.close?.();
    const container = document.getElementById("paypal-buttons");
    if (container) container.innerHTML = "";
    buttons = paypal.Buttons({
      style: { layout: "vertical", color: "gold", shape: "pill", label: "paypal" },
      createOrder: async () => {
        const normalized = machineCode.trim().toUpperCase();
        if (!/^SAG-[A-Z0-9]{12,}$/.test(normalized)) throw new Error("Enter a valid SAG-XXXXXXXXXXXX machine code first.");
        busy = true;
        message = "Creating PayPal order…";
        const response = await fetch(`${apiBase}/api/v1/paypal/orders`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ plan_id: selectedPlan }),
        });
        const data = await response.json() as { id?: string; error?: string };
        if (!response.ok || !data.id) throw new Error(data.error ?? `HTTP ${response.status}`);
        orderId = data.id;
        return data.id;
      },
      onApprove: async ({ orderID }) => {
        message = "Confirming payment and generating your activation key…";
        const response = await fetch(`${apiBase}/api/v1/paypal/orders/${encodeURIComponent(orderID)}/capture`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ order_id: orderID, machine_code: machineCode.trim().toUpperCase() }),
        });
        const data = await response.json() as { activation_key?: string; error?: string };
        if (!response.ok || !data.activation_key) throw new Error(data.error ?? `HTTP ${response.status}`);
        activationKey = data.activation_key;
        orderId = orderID;
        message = "Payment completed. Copy the activation key into saGraph Settings.";
        busy = false;
      },
      onCancel: () => { busy = false; message = "Payment cancelled. No license was issued."; },
      onError: (error) => { busy = false; message = `Payment failed: ${String(error)}`; },
    });
    await buttons.render("#paypal-buttons");
  }

  async function copyActivation() {
    await navigator.clipboard.writeText(activationKey);
    message = "Activation key copied.";
  }
</script>

<div class="purchase-shell">
  <div class="plan-list" aria-label="License duration">
    {#each plans as plan}
      <button class:active={selectedPlan === plan.id} onclick={() => { selectedPlan = plan.id; void renderButtons(); }}>
        <span>{plan.label}</span><strong>${plan.amount}</strong>
      </button>
    {/each}
  </div>
  <div class="checkout card">
    <label for="machine-code">Machine code</label>
    <input id="machine-code" bind:value={machineCode} placeholder="SAG-XXXXXXXXXXXX" autocomplete="off" spellcheck="false" />
    <p class="hint">Find this code in saGraph → Settings → License. The generated key works only on that machine.</p>
    <div id="paypal-buttons" class:disabled={busy}></div>
    <p class="status" aria-live="polite">{message}</p>
    {#if activationKey}
      <div class="result">
        <div><span>PayPal order</span><code>{orderId}</code></div>
        <label for="activation-key">Activation key</label>
        <textarea id="activation-key" readonly value={activationKey}></textarea>
        <button class="button button-primary" onclick={copyActivation}>Copy activation key</button>
      </div>
    {/if}
    <a class="recovery" href="/activate">Already paid? Recover an activation key with your PayPal order ID.</a>
  </div>
</div>

<style>
  .purchase-shell { display: grid; gap: 1.2rem; grid-template-columns: 0.85fr 1.15fr; margin-top: 3rem; }
  .plan-list { display: flex; flex-direction: column; gap: 0.7rem; }
  .plan-list button { align-items: center; background: var(--panel); border: 1px solid var(--line); border-radius: 18px; color: var(--text); cursor: pointer; display: flex; justify-content: space-between; padding: 1rem 1.1rem; text-align: left; }
  .plan-list button:hover, .plan-list button.active { background: rgba(154, 140, 255, 0.11); border-color: rgba(154, 140, 255, 0.65); }
  .plan-list span { color: var(--muted); }.plan-list strong { font-size: 1.1rem; }
  .checkout { padding: 1.5rem; }.checkout label { display: block; font-size: 0.82rem; font-weight: 700; margin-bottom: 0.55rem; }
  input, textarea { background: var(--panel-soft); border: 1px solid var(--line); border-radius: 12px; color: var(--text); font: inherit; outline: none; padding: 0.9rem 1rem; width: 100%; }
  input:focus, textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(154, 140, 255, 0.12); }
  .hint, .status, .recovery { color: var(--muted); font-size: 0.8rem; line-height: 1.6; }.hint { margin: 0.65rem 0 1.3rem; }.status { min-height: 1.4rem; }
  #paypal-buttons.disabled { opacity: 0.6; pointer-events: none; }.result { border-top: 1px solid var(--line); margin-top: 1rem; padding-top: 1.2rem; }
  .result div { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 1rem; }.result span { color: var(--muted); font-size: 0.75rem; }.result code { overflow-wrap: anywhere; }
  textarea { min-height: 115px; resize: vertical; }.result .button { border: 0; cursor: pointer; margin-top: 0.8rem; }.recovery { display: inline-block; margin-top: 1.2rem; text-decoration: underline; text-underline-offset: 3px; }
  @media (max-width: 780px) { .purchase-shell { grid-template-columns: 1fr; } }
</style>
