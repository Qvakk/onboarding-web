<script>
  import { createEventDispatcher, onMount } from 'svelte'
  import { t } from 'svelte-i18n'
  export let open = false
  export let title = ''
  export let confirmLabel = 'OK'
  export let cancelLabel = undefined // Will use translation if not provided
  export let loading = false
  export let disableConfirm = false // Disable confirm button
  export let destructive = false // style hint
  export let disableCloseOnBackdrop = false
  export let hideButtons = false // Hide footer buttons completely
  export let hideCancel = false // Hide only the cancel button
  export let width = 'min(640px, 90vw)'
  export let icon = '' // Optional material symbol name
  
  // Use translation for cancel if not explicitly provided
  $: effectiveCancelLabel = cancelLabel || $t('verifyuser.dialog_phone.cancel') || 'Cancel'

  const dispatch = createEventDispatcher()
  let dialogEl
  let previouslyFocused
  const isBrowser = typeof document !== 'undefined'

  const close = () => {
    if (!open) return
    open = false
    dispatch('close')
    restoreFocus()
  }
  const cancel = () => { dispatch('cancel'); close() }
  const confirm = () => { if (loading || disableConfirm) return; dispatch('confirm') }

  const onKey = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); cancel() }
    if (e.key === 'Tab') trapFocus(e)
  }

  const focusableSelector = 'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]'
  function trapFocus (e) {
    const focusables = dialogEl?.querySelectorAll(focusableSelector)
    if (!focusables?.length) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }
  function saveFocus () { if (isBrowser) previouslyFocused = document.activeElement }
  function restoreFocus () { if (isBrowser && previouslyFocused?.focus) previouslyFocused.focus() }

  $: if (open && isBrowser) {
    setTimeout(() => {
      saveFocus()
      const primary = dialogEl?.querySelector('[data-autofocus]') || dialogEl?.querySelector(focusableSelector)
      primary && primary.focus()
    }, 0)
  }

  const backdropClick = (e) => {
    if (disableCloseOnBackdrop) return
    if (e.target === e.currentTarget) cancel()
  }

  onMount(() => () => restoreFocus())
</script>

{#if open}
  <div
    class="cd-overlay"
    role="button"
    tabindex="-1"
    aria-label="Close dialog"
    on:click={backdropClick}
    on:keydown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); backdropClick(e) } }}
  >
    <div class="cd-dialog" role="dialog" aria-modal="true" aria-labelledby="cd-title" aria-describedby="cd-desc" bind:this={dialogEl} style={`max-width:${width}`}>      
      <header class="cd-header">
        {#if icon}
          <span class="material-symbols-outlined cd-icon" aria-hidden="true">{icon}</span>
        {/if}
        <h2 id="cd-title">{title}</h2>
      </header>
      <div id="cd-desc" class="cd-body">
        <slot />
      </div>
      {#if !hideButtons}
        <footer class="cd-footer">
          {#if !hideCancel}
            <button class="cd-btn secondary" type="button" on:click={cancel} disabled={loading} on:keydown={onKey}>{effectiveCancelLabel}</button>
          {/if}
          <slot name="extraButtons" />
          <button class={`cd-btn primary ${destructive ? 'destructive' : ''}`} data-autofocus type="button" on:click={confirm} disabled={loading || disableConfirm} on:keydown={onKey}>
            {#if loading}<span class="cd-spinner" aria-hidden="true"></span>{/if}
            {confirmLabel}
          </button>
        </footer>
      {/if}
      <button class="cd-close" type="button" aria-label="Lukk" on:click={cancel} disabled={loading} on:keydown={onKey}>
        <span class="material-symbols-outlined" aria-hidden="true">close</span>
      </button>
    </div>
  </div>
{/if}

<style>
  .cd-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.4);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 40px 16px;
    z-index: 1000;
    overflow-y: auto;
  }
  .cd-dialog {
    background: var(--white, #fff);
    color: var(--text-color, #111);
    border-radius: 8px;
    position: relative;
    box-shadow: 0 10px 30px rgba(0,0,0,.25);
    width: 100%;
    display: flex;
    flex-direction: column;
    animation: cd-pop .18s ease-out;
  }
  @keyframes cd-pop { from { transform: translateY(8px); opacity:0 } to { transform: translateY(0); opacity:1 } }
  .cd-header { padding: 20px 24px 8px; display:flex; align-items:center; gap:10px; }
  .cd-header h2 { margin:0; font-size:1.2rem; line-height:1.3; }
  .cd-icon { font-size: 28px; color: var(--spinner-color, var(--primary-color, #0066aa)); }
  .cd-body { padding: 0 24px 24px; line-height: 1.5; }
  .cd-footer { padding: 12px 24px 20px; display:flex; justify-content:flex-end; gap:12px; flex-wrap:wrap; }
  /* Ensure slotted buttons get identical styling in footer and body (for inline actions like Resend) */
  .cd-footer :global(.cd-btn),
  .cd-body :global(.cd-btn) {
    font: inherit;
    font-size: 16px;
    line-height: 1.2;
    border-radius:4px;
    border:1px solid transparent;
    padding:12px 16px;
    min-height: 44px;
    min-width: 44px;
    cursor:pointer;
    display:inline-flex;
    align-items:center;
    justify-content: center;
    gap:8px;
    user-select: none;
    touch-action: manipulation;
  }
  .cd-footer :global(.cd-btn:focus-visible),
  .cd-body :global(.cd-btn:focus-visible) { outline: 3px solid var(--focus-ring, #6aa9ff); outline-offset: 2px; }
  .cd-footer :global(.cd-btn.secondary),
  .cd-body :global(.cd-btn.secondary) { background: var(--button-secondary-bg, #e1e9f0); color: var(--text-color,#111); }
  .cd-footer :global(.cd-btn.secondary:hover),
  .cd-body :global(.cd-btn.secondary:hover) { background: var(--button-secondary-hover,#d3dde6); }
  .cd-footer :global(.cd-btn.primary),
  .cd-body :global(.cd-btn.primary) { background: var(--button-background, var(--primary-color,#0066aa)); color: var(--button-text, #fff); }
  .cd-footer :global(.cd-btn.primary:hover),
  .cd-body :global(.cd-btn.primary:hover) { background: var(--button-hover, var(--primary-color-dark,#004f82)); }
  .cd-footer :global(.cd-btn.primary.destructive),
  .cd-body :global(.cd-btn.primary.destructive) { background: var(--error-background,#b00020); color: var(--error-text,#fff); }
  .cd-footer :global(.cd-btn.primary.destructive:hover),
  .cd-body :global(.cd-btn.primary.destructive:hover) { background: var(--error-border,#7a0016); }
  .cd-footer :global(.cd-btn[disabled]),
  .cd-body :global(.cd-btn[disabled]) { opacity:.6; cursor:not-allowed; }
  .cd-close { position:absolute; top:6px; right:6px; background:transparent; border:none; cursor:pointer; padding:6px; border-radius:4px; }
  .cd-close:hover { background: var(--button-secondary-bg,#e1e9f0); }
  .cd-spinner { width:16px; height:16px; border-radius:50%; border:2px solid rgba(255,255,255,0.6); border-top-color:#fff; animation: cd-spin .6s linear infinite; }
  @keyframes cd-spin { to { transform: rotate(360deg); } }
  @media (max-width: 640px) { .cd-dialog { padding-bottom:8px; } }
  @media (max-width: 480px) {
    .cd-footer { flex-direction: column-reverse; align-items: stretch; }
  .cd-footer :global(.cd-btn) { width: 100%; }
  }
  @media (min-width: 600px) {
    .cd-overlay { align-items: center; }
    .cd-header { padding: 24px 28px 12px; }
    .cd-header h2 { font-size: 1.35rem; }
    .cd-body { padding: 0 28px 28px; font-size: 1.05rem; }
    .cd-footer { padding: 16px 28px 24px; }
    .cd-footer :global(.cd-btn),
    .cd-body :global(.cd-btn) {
      font-size: 1.05rem;
      padding: 14px 22px;
      min-height: 48px;
    }
  }
  @media (min-width: 900px) {
    .cd-dialog { max-width: min(700px, 85vw); }
    .cd-header h2 { font-size: 1.45rem; }
    .cd-body { font-size: 1.1rem; }
  }
</style>
