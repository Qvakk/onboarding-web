<script>
  import { onMount } from 'svelte'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import IconSpinner from '$lib/components/Icons/IconSpinner.svelte'
  import InfoBox from '$lib/components/InfoBox.svelte'
  import { resetMfaMethods } from '$lib/useApi'
  import { t } from 'svelte-i18n'

  let loadingMessage = $t('verifyuser.mfa_reset_wait')
  let error

  onMount(async () => {
    const code = $page.url.searchParams.get('code')
    const state = $page.url.searchParams.get('state')

    if (!(code && state)) {
      return goto('/')
    }

    try {
      await resetMfaMethods(code)
      // Retrieve original verify params from sessionStorage and proceed
      const stored = sessionStorage.getItem('verifyuser.auth')
      if (stored) {
        const { code: vcode, iss, state: vstate } = JSON.parse(stored)
        sessionStorage.removeItem('verifyuser.auth')
        sessionStorage.setItem('verifyuser.postReset', '1')
        return goto('/verifyuser', { state: { code: vcode, iss, state: vstate }, replaceState: true })
      }
      // Fallback: go to homepage
      return goto('/')
    } catch (e) {
      error = e.response?.data?.message || e.stack || e.toString()
    }
  })
</script>

<div class="centerstuff">
  {#if error}
    <InfoBox type="error">
      <h2>{$t('error.title')}</h2>
      <p>{error}</p>
      <button on:click={() => goto('/')}>{$t('entrapwdcallback.try_again')}</button>
    </InfoBox>
  {:else}
    <div class="loading">
      <IconSpinner />
      <p class="loadingMessage">{loadingMessage}...</p>
    </div>
  {/if}
</div>

<style>
  .loading { display:flex; flex-direction:column; align-items:center; gap:10px; padding:40px 0; }
  .loadingMessage { font-size:1rem; }
</style>
