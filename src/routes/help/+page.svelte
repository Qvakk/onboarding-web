<script>
  import { goto } from '$app/navigation';
  import { t } from 'svelte-i18n';

  // Update document title when translation loads
  $: if (typeof document !== 'undefined' && $t('page.help.title')) {
    document.title = `${$t('page.help.title')} | Brukerkonto`;
  }

  function goBack() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      goto('/');
    }
  }
</script>

<svelte:head>
</svelte:head>

<div>
  <h1>{$t('page.help.heading')}</h1>
  <h2>{$t('help.about_verification')}</h2>
  {$t('help.about_text')}<br />
  <br />
  {$t('help.steps')}<br />
  {$t('help.steps_list')}<br />
  <br />
  <h2>{$t('help.stuck')}</h2>
  {$t('help.contact_student')}<br />
  {$t('help.contact_employee')}
  <br />
  <button class="back-btn" on:click={goBack}>&larr; {$t('home.title')}</button>
</div>

<style>
.back-btn {
  margin-top: 2em;
  padding: 0.5em 1.5em;
  border-radius: 6px;
  border: 1px solid #ccc;
  font-size: 1em;
  cursor: pointer;
  transition: background 0.2s;
}
.back-btn:hover {
  background: var(--button-hover);
}
</style>