/**
 * Reusable composable for admin authentication flow
 * Handles OAuth code/state validation and prevents duplicate API calls
 */

import { writable } from 'svelte/store';

/**
 * Creates admin auth state manager
 * @returns {Object} Admin auth utilities
 */
export function useAdminAuth() {
  let hasFetchedOnce = false;
  const loading = writable(true);
  const error = writable(null);

  /**
   * Executes admin API call with duplicate prevention
   * NEW: Supports both OAuth (first-time) and session token (subsequent) authentication
   * @param {Function} apiCall - Async function to call the API
   * @param {string} code - OAuth authorization code (optional if sessionToken provided)
   * @param {string} state - OAuth state parameter (optional if sessionToken provided)
   * @param {string} sessionToken - Session token from previous authentication (optional)
   * @returns {Promise<any>} API response data
   */
  async function executeAdminCall(apiCall, code, state, sessionToken = null) {
    // Allow call if:
    // 1. First call (OAuth authentication)
    // 2. Subsequent call with session token
    const isFirstCall = !hasFetchedOnce;
    const isSessionCall = sessionToken && hasFetchedOnce;
    
    if (!isFirstCall && !isSessionCall) {
      console.log('Admin API call already in progress or completed, skipping duplicate');
      return null;
    }
    
    if (isFirstCall) {
      hasFetchedOnce = true;
    }
    
    loading.set(true);
    error.set(null);

    try {
      // Call API with either OAuth parameters or session token
      const result = await apiCall(code, state, sessionToken);
      loading.set(false);
      return result;
    } catch (err) {
      loading.set(false);
      error.set(err);
      throw err;
    }
  }

  /**
   * Resets the fetch state (useful for testing or retry scenarios)
   */
  function reset() {
    hasFetchedOnce = false;
    loading.set(true);
    error.set(null);
  }

  /**
   * Checks if the OAuth call has already been executed
   */
  function hasExecuted() {
    return hasFetchedOnce;
  }

  return {
    loading,
    error,
    executeAdminCall,
    reset,
    hasExecuted
  };
}
