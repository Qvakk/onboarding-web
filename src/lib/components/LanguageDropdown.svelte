<script>
  import { locale } from '$lib/i18n';
  import { t } from 'svelte-i18n';
  export let languages = [
    { code: 'nb', label: 'Bokmål' },
    { code: 'nn', label: 'Nynorsk' },
    { code: 'en', label: 'English' },
    { code: 'se', label: 'Davvisámegiella' }
  ];
  export let className = '';
  export let onChange = null;
  // Accept external bound value (for API compatibility); if provided keep it in sync with $locale
  export let value; // optional incoming locale code

  $: if (value && value !== $locale) {
    // Update global locale when external value changes
    locale.set(value);
  }
</script>

<div class={className}>
  <label for="language-select" class="visually-hidden">{$t('language.label')}</label>
  <select id="language-select" bind:value={$locale} on:change={(e) => { if (onChange) onChange(e); }}>
    {#each languages as lang}
      <option value={lang.code}>{lang.label}</option>
    {/each}
  </select>
</div>

<style>
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
select {
    padding: 8px 32px 8px 12px;
    border-radius: 8px;
    border: 1px solid #ccc;
    background: #fff url('data:image/svg+xml;utf8,<svg fill="gray" height="20" viewBox="0 0 24 24" width="20" xmlns="http://www.w3.org/2000/svg"><path d="M7 10l5 5 5-5z"/></svg>') no-repeat right 10px center/18px 18px;
    font-size: 1em;
    color: #000;
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    min-width: 120px;
    transition: border-color 0.2s, box-shadow 0.2s;
    box-shadow: 0 2px 8px 0 rgba(0,0,0,0.04);
    cursor: pointer;
    height: 40px;
    vertical-align: middle;
    margin: 0;
}
select:focus, select:hover {
    border-color: #888;
    outline: none;
    box-shadow: 0 2px 8px 0 rgba(0,0,0,0.10);
}
</style>
