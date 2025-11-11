<script>
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import PasswordVerification from '$lib/components/PasswordVerification.svelte';
  import { locale, t } from 'svelte-i18n';

  // Update document title when translation loads
  $: if (typeof document !== 'undefined' && $t('page.verifypassword.title')) {
    document.title = `${$t('page.verifypassword.title')} | Brukerkonto`;
  }
  
  let confirmationState = '';
  let currentLanguage = 'nb';

  onMount(() => {
    confirmationState = $page.url.searchParams.get('state') || '';
    
    if (!confirmationState) {
      goto('/');
      return;
    }

    // Get language from store
    const unsubscribe = locale.subscribe(lang => {
      currentLanguage = lang;
    });

    return unsubscribe;
  });
</script>

<svelte:head>
</svelte:head>

{#if confirmationState}
  <PasswordVerification 
    {confirmationState} 
    language={currentLanguage}
  />
{/if}
