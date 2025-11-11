<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { t } from 'svelte-i18n';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  export let confirmationState = '';
  export let language = 'nb';
  export let inline = false; // Whether to show inline (in dialog) or as standalone page

  let tempPassword = '';
  let newPassword = '';
  let confirmPassword = '';
  let error = '';
  let loading = false;
  let showTempPassword = false;
  let showNewPassword = false;
  let showConfirmPassword = false;
  let attemptsLeft = 3;

  $: passwordRequirements = {
    length: newPassword.length >= 12,
    lowercase: /[a-z]/.test(newPassword),
    uppercase: /[A-Z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword)
  };

  $: passwordsMatch = newPassword && newPassword === confirmPassword;
  $: allRequirementsMet = Object.values(passwordRequirements).every(req => req);
  $: canSubmit = tempPassword && newPassword && confirmPassword && passwordsMatch && allRequirementsMet && !loading;

  async function handleSubmit() {
    error = '';
    
    if (!tempPassword || !newPassword || !confirmPassword) {
      error = $t('passwordVerification.errors.missing_fields');
      return;
    }

    if (!passwordsMatch) {
      error = $t('passwordVerification.errors.passwords_must_match');
      return;
    }

    if (!allRequirementsMet) {
      error = $t('passwordVerification.errors.password_requirements_not_met');
      return;
    }

    loading = true;

    try {
      const response = await fetch('/api/verify-temp-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          confirmationState,
          tempPassword,
          newPassword,
          language
        })
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.attemptsLeft !== undefined) {
          attemptsLeft = data.attemptsLeft;
          error = $t('passwordVerification.errors.invalid_temp_password').replace('{attemptsLeft}', attemptsLeft);
        } else if (data.message) {
          const errorKey = `passwordVerification.errors.${data.message}`;
          error = $t(errorKey) || data.message;
        } else {
          error = $t('passwordVerification.errors.password_set_failed');
        }
        return;
      }

      // Success! Either dispatch event (inline mode) or navigate (standalone)
      if (inline) {
        // Dispatch event for parent to handle
        dispatch('success', { 
          userPrincipalName: data.userPrincipalName,
          correlationId: data.correlationId
        });
      } else {
        // Navigate to success page with username
        if (data.userPrincipalName) {
          goto(`/success?username=${encodeURIComponent(data.userPrincipalName)}`);
        } else {
          goto('/success');
        }
      }
    } catch (err) {
      console.error('Password verification error:', err);
      error = $t('passwordVerification.errors.password_set_failed');
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    if (!inline && !confirmationState) {
      goto('/');
    }
  });
</script>

<div class:container={!inline}>
  {#if !inline}
    <h1>{$t('passwordVerification.title')}</h1>
    
    <div class="info-box">
      <p>{$t('passwordVerification.info')}</p>
    </div>
  {/if}

  <form on:submit|preventDefault={handleSubmit}>
    <!-- Temporary Password -->
    <div class="form-group">
      <label for="tempPassword">{$t('passwordVerification.tempPasswordLabel')}</label>
      <div class="password-input-wrapper">
        <input
          id="tempPassword"
          type={showTempPassword ? 'text' : 'password'}
          value={tempPassword}
          on:input={(e) => tempPassword = e.target.value}
          disabled={loading}
          autocomplete="off"
          required
        />
        <button
          type="button"
          class="toggle-password"
          on:click={() => showTempPassword = !showTempPassword}
          aria-label={showTempPassword ? $t('passwordVerification.hidePassword') : $t('passwordVerification.showPassword')}
        >
          {#if showTempPassword}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M30.94,15.66a16.4,16.4,0,0,0-5.73-7.45L30,3.41,28.59,2,2,28.59,3.41,30l5.1-5.09A15.38,15.38,0,0,0,16,27,16.69,16.69,0,0,0,30.94,16.34,1,1,0,0,0,30.94,15.66ZM16,22.5a6.46,6.46,0,0,1-3.83-1.26L14,19.43A4,4,0,0,0,19.43,14l1.81-1.81A6.49,6.49,0,0,1,16,22.5Z"/><path d="M4.53,21.81l5-5A6.84,6.84,0,0,1,9.5,16,6.51,6.51,0,0,1,16,9.5a6.84,6.84,0,0,1,.79.05l3.78-3.77A14.39,14.39,0,0,0,16,5,16.69,16.69,0,0,0,1.06,15.66a1,1,0,0,0,0,.68A15.86,15.86,0,0,0,4.53,21.81Z"/></svg>
          {:else}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="4"/><path d="M30.94,15.66A16.69,16.69,0,0,0,16,5,16.69,16.69,0,0,0,1.06,15.66a1,1,0,0,0,0,.68A16.69,16.69,0,0,0,16,27,16.69,16.69,0,0,0,30.94,16.34,1,1,0,0,0,30.94,15.66ZM16,22.5A6.5,6.5,0,1,1,22.5,16,6.51,6.51,0,0,1,16,22.5Z"/></svg>
          {/if}
        </button>
      </div>
    </div>

    <!-- New Password -->
    <div class="form-group">
      <label for="newPassword">{$t('passwordVerification.newPasswordLabel')}</label>
      <div class="password-input-wrapper">
        <input
          id="newPassword"
          type={showNewPassword ? 'text' : 'password'}
          value={newPassword}
          on:input={(e) => newPassword = e.target.value}
          disabled={loading}
          autocomplete="new-password"
          required
        />
        <button
          type="button"
          class="toggle-password"
          on:click={() => showNewPassword = !showNewPassword}
          aria-label={showNewPassword ? $t('passwordVerification.hidePassword') : $t('passwordVerification.showPassword')}
        >
          {#if showNewPassword}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M30.94,15.66a16.4,16.4,0,0,0-5.73-7.45L30,3.41,28.59,2,2,28.59,3.41,30l5.1-5.09A15.38,15.38,0,0,0,16,27,16.69,16.69,0,0,0,30.94,16.34,1,1,0,0,0,30.94,15.66ZM16,22.5a6.46,6.46,0,0,1-3.83-1.26L14,19.43A4,4,0,0,0,19.43,14l1.81-1.81A6.49,6.49,0,0,1,16,22.5Z"/><path d="M4.53,21.81l5-5A6.84,6.84,0,0,1,9.5,16,6.51,6.51,0,0,1,16,9.5a6.84,6.84,0,0,1,.79.05l3.78-3.77A14.39,14.39,0,0,0,16,5,16.69,16.69,0,0,0,1.06,15.66a1,1,0,0,0,0,.68A15.86,15.86,0,0,0,4.53,21.81Z"/></svg>
          {:else}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="4"/><path d="M30.94,15.66A16.69,16.69,0,0,0,16,5,16.69,16.69,0,0,0,1.06,15.66a1,1,0,0,0,0,.68A16.69,16.69,0,0,0,16,27,16.69,16.69,0,0,0,30.94,16.34,1,1,0,0,0,30.94,15.66ZM16,22.5A6.5,6.5,0,1,1,22.5,16,6.51,6.51,0,0,1,16,22.5Z"/></svg>
          {/if}
        </button>
      </div>
      
      <div class="requirements">
        <p class="requirements-title">{$t('passwordVerification.requirementsTitle')}</p>
        <ul>
          <li class:met={passwordRequirements.length}>
            ✓ {$t('passwordVerification.minLength')}
          </li>
          <li class:met={passwordRequirements.lowercase}>
            ✓ {$t('passwordVerification.lowercase')}
          </li>
          <li class:met={passwordRequirements.uppercase}>
            ✓ {$t('passwordVerification.uppercase')}
          </li>
          <li class:met={passwordRequirements.number}>
            ✓ {$t('passwordVerification.number')}
          </li>
          <li class:met={passwordRequirements.special}>
            ✓ {$t('passwordVerification.specialChar')}
          </li>
        </ul>
      </div>
      
      <div class="backend-note">
        <p>{$t('passwordVerification.backendValidationNote')}</p>
      </div>
    </div>

    <!-- Confirm Password -->
    <div class="form-group">
      <label for="confirmPassword">{$t('passwordVerification.confirmPasswordLabel')}</label>
      <div class="password-input-wrapper">
        <input
          id="confirmPassword"
          type={showConfirmPassword ? 'text' : 'password'}
          value={confirmPassword}
          on:input={(e) => confirmPassword = e.target.value}
          disabled={loading}
          autocomplete="new-password"
          required
        />
        <button
          type="button"
          class="toggle-password"
          on:click={() => showConfirmPassword = !showConfirmPassword}
          aria-label={showConfirmPassword ? $t('passwordVerification.hidePassword') : $t('passwordVerification.showPassword')}
        >
          {#if showConfirmPassword}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M30.94,15.66a16.4,16.4,0,0,0-5.73-7.45L30,3.41,28.59,2,2,28.59,3.41,30l5.1-5.09A15.38,15.38,0,0,0,16,27,16.69,16.69,0,0,0,30.94,16.34,1,1,0,0,0,30.94,15.66ZM16,22.5a6.46,6.46,0,0,1-3.83-1.26L14,19.43A4,4,0,0,0,19.43,14l1.81-1.81A6.49,6.49,0,0,1,16,22.5Z"/><path d="M4.53,21.81l5-5A6.84,6.84,0,0,1,9.5,16,6.51,6.51,0,0,1,16,9.5a6.84,6.84,0,0,1,.79.05l3.78-3.77A14.39,14.39,0,0,0,16,5,16.69,16.69,0,0,0,1.06,15.66a1,1,0,0,0,0,.68A15.86,15.86,0,0,0,4.53,21.81Z"/></svg>
          {:else}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="4"/><path d="M30.94,15.66A16.69,16.69,0,0,0,16,5,16.69,16.69,0,0,0,1.06,15.66a1,1,0,0,0,0,.68A16.69,16.69,0,0,0,16,27,16.69,16.69,0,0,0,30.94,16.34,1,1,0,0,0,30.94,15.66ZM16,22.5A6.5,6.5,0,1,1,22.5,16,6.51,6.51,0,0,1,16,22.5Z"/></svg>
          {/if}
        </button>
      </div>
      {#if confirmPassword && !passwordsMatch}
        <p class="error-text">{$t('passwordVerification.passwordsDoNotMatch')}</p>
      {/if}
      {#if confirmPassword && passwordsMatch}
        <p class="success-text">{$t('passwordVerification.passwordsMatch')}</p>
      {/if}
    </div>

    {#if error}
      <div class="error-box" role="alert">
        {error}
      </div>
    {/if}

    <button
      type="submit"
      class="submit-button"
      disabled={!canSubmit}
    >
      {loading ? $t('passwordVerification.submitting') : $t('passwordVerification.submitButton')}
    </button>
  </form>
</div>

<style>
  .container {
    max-width: 500px;
    margin: 2rem auto;
    padding: 2rem;
  }

  h1 {
    color: #333;
    margin-bottom: 1.5rem;
    font-size: 1.75rem;
  }

  .info-box {
    background: #e3f2fd;
    padding: 0.6rem;
    border-radius: 4px;
    margin-bottom: 0.75rem;
    border-left: 4px solid #1976d2;
    font-size: 0.85rem;
  }

  .form-group {
    margin-bottom: 0.75rem;
  }

  label {
    display: block;
    margin-bottom: 0.4rem;
    font-weight: 600;
    color: #333;
    font-size: 0.9rem;
  }

  .password-input-wrapper {
    position: relative;
  }

  input {
    width: 100%;
    padding: 0.6rem;
    padding-right: 3rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.95rem;
    box-sizing: border-box;
  }

  input:focus {
    outline: none;
    border-color: #1976d2;
    box-shadow: 0 0 0 3px rgba(25, 118, 210, 0.1);
  }

  input:disabled {
    background: #f5f5f5;
    cursor: not-allowed;
  }

  .toggle-password {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .toggle-password svg {
    width: 20px;
    height: 20px;
    fill: #666;
  }

  .toggle-password:hover svg {
    fill: #1976d2;
  }

  .requirements {
    margin-top: 0.5rem;
    padding: 0.6rem;
    background: #f9f9f9;
    border-radius: 4px;
    border: 1px solid #e0e0e0;
  }

  .requirements-title {
    font-weight: 600;
    margin-bottom: 0.3rem;
    color: #555;
    font-size: 0.85rem;
  }

  .requirements ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .requirements li {
    padding: 0.15rem 0;
    color: #999;
    font-size: 0.85rem;
  }

  .requirements li.met {
    color: #4caf50;
    font-weight: 600;
  }
  
  .backend-note {
    margin-top: 0.75rem;
    padding: 0.5rem 0.75rem;
    background: #f5f5f5;
    border-left: 3px solid #666;
    border-radius: 3px;
  }
  
  .backend-note p {
    margin: 0;
    font-size: 0.8rem;
    color: #555;
    line-height: 1.4;
  }

  .error-text {
    color: #f44336;
    font-size: 0.8rem;
    margin-top: 0.2rem;
  }

  .success-text {
    color: #4caf50;
    font-size: 0.8rem;
    margin-top: 0.2rem;
    font-weight: 600;
  }

  .error-box {
    background: #ffebee;
    color: #c62828;
    padding: 0.75rem;
    border-radius: 4px;
    margin-bottom: 0.75rem;
    border-left: 4px solid #f44336;
    font-size: 0.9rem;
  }

  .submit-button {
    width: 100%;
    padding: 0.75rem;
    background: #1976d2;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }

  .submit-button:hover:not(:disabled) {
    background: #1565c0;
  }

  .submit-button:disabled {
    background: #ccc;
    cursor: not-allowed;
    opacity: 0.6;
  }

  @media (max-width: 600px) {
    .container {
      padding: 1rem;
    }

    h1 {
      font-size: 1.5rem;
    }
  }
</style>
