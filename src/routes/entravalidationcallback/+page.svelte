<script>
  import { onMount } from 'svelte'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { getThemeAsset } from '$lib/themes/theme.config'
  import IconSpinner from '$lib/components/Icons/IconSpinner.svelte'
  import { t } from 'svelte-i18n';

  const loadingIcon = getThemeAsset('images/loading.svg')
  let loadingMessage = $t('entravalidationcallback.redirecting');

  onMount(() => {
    const code = $page.url.searchParams.get('code')
    const state = $page.url.searchParams.get('state')

    if (!(code && state)) {
      console.log('De er ikke der, slutt å kødde')
      goto('/')
    }
    
    // Check state prefix and redirect to corresponding page
    if (state.startsWith('debug') || state.startsWith('admin')) {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('admin_auth_in_progress', 'true')
      }
      
      // All admin-related actions go to /debug
      goto('/debug', { state: { code, state }, replaceState: true })
    } else {
      // Default: validation flow
      goto('/success', { state: { code, state }, replaceState: true })
    }
  })
</script>

<div class="centerstuff">
  <div class="loading">
    <IconSpinner />
    <p class="loadingMessage">{loadingMessage}</p>
  </div>
</div>