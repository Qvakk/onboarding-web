<script>
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import IconSpinner from '$lib/components/Icons/IconSpinner.svelte';

  let errorMessage = null;

  onMount(() => {
    console.log('[ADMIN-AUTH-CALLBACK] Processing admin authentication callback');
    
    // Get OAuth code and state from URL
    const code = $page.url.searchParams.get('code');
    const state = $page.url.searchParams.get('state');
    const error = $page.url.searchParams.get('error');
    const errorDescription = $page.url.searchParams.get('error_description');

    // Handle OAuth errors
    if (error) {
      console.error('[ADMIN-AUTH-CALLBACK] OAuth error:', error, errorDescription);
      errorMessage = errorDescription || error;
      return;
    }

    // Validate we have the required parameters
    if (!code || !state) {
      console.error('[ADMIN-AUTH-CALLBACK] Missing code or state parameter');
      errorMessage = 'Invalid callback - missing authentication parameters';
      return;
    }

    console.log('[ADMIN-AUTH-CALLBACK] OAuth code received, state prefix:', state.substring(0, 10));

    // Route to the appropriate page based on state prefix
    if (state.startsWith('debug')) {
      console.log('[ADMIN-AUTH-CALLBACK] Routing to /debug');
      goto('/debug', { state: { code, state } });
    } else if (state.startsWith('stats')) {
      console.log('[ADMIN-AUTH-CALLBACK] Routing to /stats');
      goto('/stats', { state: { code, state } });
    } else if (state.startsWith('admin')) {
      console.log('[ADMIN-AUTH-CALLBACK] Routing to /debug (default for admin)');
      goto('/debug', { state: { code, state } });
    } else {
      console.error('[ADMIN-AUTH-CALLBACK] Unknown state prefix:', state.substring(0, 10));
      errorMessage = 'Invalid admin authentication state';
    }
  });
</script>

{#if errorMessage}
  <div class="error-container">
    <h2>Authentication Error</h2>
    <p>{errorMessage}</p>
    <a href="/admin" class="back-link">← Back to Admin Login</a>
  </div>
{:else}
  <div class="loading-container">
    <IconSpinner />
    <p>Processing admin authentication...</p>
  </div>
{/if}

<style>
  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    gap: 20px;
  }

  .loading-container p {
    font-size: 16px;
    color: #666;
  }

  .error-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 20px;
    text-align: center;
  }

  .error-container h2 {
    color: #c62828;
    margin-bottom: 16px;
  }

  .error-container p {
    color: #666;
    margin-bottom: 24px;
    max-width: 500px;
  }

  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    background: var(--primary-color, #0176ac);
    color: white;
    text-decoration: none;
    border-radius: 4px;
    transition: background 0.2s;
  }

  .back-link:hover {
    background: var(--primary-color-dark, #015a8a);
  }
</style>
