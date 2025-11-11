<script>
  import { goto } from '$app/navigation';
  import { t } from 'svelte-i18n';

  export let active = 'debug'; // 'debug' or 'stats'
</script>

<div class="tab-navigation">
  <button 
    class="tab" 
    class:active={active === 'debug'}
    disabled={active === 'debug'}
    on:click={() => goto('/debug')}
  >
    <span class="material-symbols-outlined">terminal</span>
    {$t('debug.tabTitle')}
  </button>
  <button 
    class="tab" 
    class:active={active === 'stats'}
    disabled={active === 'stats'}
    on:click={() => goto('/stats')}
  >
    <span class="material-symbols-outlined">analytics</span>
    {$t('stats.tabTitle')}
  </button>
</div>

<style>
  .tab-navigation {
    display: flex;
    gap: 8px;
    margin-bottom: 20px;
    padding: 12px 20px;
    border-bottom: 2px solid #ddd;
  }

  .tab {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    background: #f5f5f5;
    border: none;
    border-bottom: 3px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    min-height: 0;
    transition: all 0.2s;
    color: #333 !important;
  }

  .tab .material-symbols-outlined {
    color: #333 !important;
  }

  .tab:hover:not(:disabled) {
    background: #e0e0e0;
  }

  .tab.active {
    background: white;
    border-bottom-color: var(--primary-color, #0176ac);
    cursor: default;
    font-weight: 600;
    color: #333 !important;
  }

  .tab.active .material-symbols-outlined {
    color: #333 !important;
  }

  .tab:disabled {
    opacity: 1 !important;
    color: #333 !important;
    cursor: default;
  }
</style>
