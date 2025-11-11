<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import IconSpinner from '$lib/components/Icons/IconSpinner.svelte';
  import { t } from 'svelte-i18n';

  let loadingMessage = $t('validationcallback.redirecting') || 'Redirecting...';

  onMount(() => {
    const code = $page.url.searchParams.get('code');
    const state = $page.url.searchParams.get('state');

    if (!(code && state)) {
      return goto('/');
    }

    if (state && (state.startsWith('debug') || state.startsWith('admin'))) {
      goto('/debug', { state: { code, state }, replaceState: true });
    } else {
      goto('/success', { state: { code, state }, replaceState: true });
    }
  });
</script>

<div class="centerstuff">
  <div class="loading">
    <IconSpinner />
    <p class="loadingMessage">{loadingMessage}</p>
  </div>
</div>
