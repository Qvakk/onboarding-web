<script>
  import { onMount } from 'svelte'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { t } from 'svelte-i18n';

  onMount(() => {
    const code = $page.url.searchParams.get('code')
    const state = $page.url.searchParams.get('state')
    const iss = $page.url.searchParams.get('iss')
    const demo = $page.url.searchParams.get('demo')

    if (!(code && state && iss)) {
      goto('/')
    } else {
      // Only handle 'verifyuser' action - streamlined FINT-only flow
      const actionString = state.substring(0,30)
      if (actionString.includes('verifyuser')) {
        goto('/verifyuser' + (demo ? `?demo=${encodeURIComponent(demo)}` : ''), { state: { code, state, iss }, replaceState: true })
      } else {
        console.error('Invalid action in state parameter:', actionString)
        goto('/')
      }
    }
  })

  let loadingMessage = $t('idportencallback.redirecting');
</script>

<div class="centeredstuff ">
  {$t('idportencallback.redirecting')}
</div>


<style>
</style>