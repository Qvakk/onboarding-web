<script>
  import { getAdminLoginUrl } from '../../lib/useApi'
  import { t } from 'svelte-i18n'

  // Update document title when translation loads
  $: if (typeof document !== 'undefined' && $t('page.admin.title')) {
    document.title = `${$t('page.admin.title')} | Brukerkonto`;
  }

  let errorMessage = null
  let loading = false

  const login = async () => {
    errorMessage = null
    try {
      loading = true
      console.log('Calling getAdminLoginUrl with action=debug')
      const { loginUrl } = await getAdminLoginUrl()
      console.log('Got loginUrl:', loginUrl)
      loading = false
      window.location.href = loginUrl
    } catch (error) {
      loading = false
      console.error('Login error:', error)
      errorMessage = error.response?.data?.message || error.toString()
    }
  }
</script>

<svelte:head>
</svelte:head>

<main>
  {#if errorMessage}}
    <div class="centerstuff">
      <div class="error">
        <h3 class="errorTitle">Oi, noe gikk galt 😩</h3>
        <p>{errorMessage}</p>
      </div>
    </div>
  {/if}
  <div class="centerstuff">
    <div class="admin-container">
      <h3>{$t('admin.title')}</h3>
      <button class="big admin-button" on:click={login} disabled={loading}>
        <span class="material-symbols-outlined">login</span>
        {loading ? $t('admin.loading') + '...' : $t('admin.loginButton')}
      </button>
    </div>
  </div>
</main>


<style>
  .centerstuff {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      margin-top: 2rem;
  }
  
  .admin-container {
    text-align: center;
    max-width: 400px;
  }
  
  .admin-container h3 {
    margin-bottom: 1.5rem;
    color: var(--heading-color);
  }
  
  .admin-button {
    width: 100%;
    min-height: 60px;
    font-size: 1.2em;
    font-weight: 600;
    gap: 0.5rem;
    background-color: var(--button-background);
    color: var(--button-text);
    border: 2px solid var(--button-background);
  }
  
  .admin-button:hover:not(:disabled) {
    background-color: var(--button-hover);
    border-color: var(--button-hover);
  }
  
  .admin-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .error {
    text-align: center;
    background-color: var(--error-background, #f44336);
    color: var(--error-text, #ffffff);
    padding: 1.5rem;
    border-radius: 8px;
    max-width: 500px;
    margin: 1rem;
  }
  
  .errorTitle {
    color: var(--error-text, #ffffff);
    margin-bottom: 0.5rem;
  }
  
  .error p {
    color: var(--error-text, #ffffff);
  }
</style>