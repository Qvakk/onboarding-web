<script>
  import { goto } from '$app/navigation';
  import { t } from 'svelte-i18n';

  export let confirmationState = '';
  export let phoneNumber = '';
  
  // Check if we're in mock mode to show the temp password
  const isMockMode = import.meta.env.VITE_MOCK_API === 'true';
  const mockTempPassword = 'Demo1234'; // This is the password user should enter
</script>

<div class="container">
  <div class="success-icon">✅</div>
  
  <h1>{$t('smsSuccess.title')}</h1>
  
  <div class="success-box">
    <p>{$t('smsSuccess.message')}</p>
    {#if phoneNumber}
      <p class="phone-number">{phoneNumber}</p>
    {/if}
    <p>{$t('smsSuccess.instruction')}</p>
    
    {#if isMockMode}
      <div class="mock-password-box">
        <p class="mock-label">🔧 MOCK MODE - Your temporary password:</p>
        <p class="mock-password">{mockTempPassword}</p>
        <p class="mock-hint">Use this password on the next screen</p>
      </div>
    {/if}
  </div>

  <button 
    class="continue-button" 
    on:click={() => goto(`/verify-password?state=${encodeURIComponent(confirmationState)}`)}
  >
    {$t('smsSuccess.continueButton')}
  </button>
</div>

<style>
  .container {
    max-width: 500px;
    margin: 2rem auto;
    padding: 2rem;
    text-align: center;
  }

  .success-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
    animation: bounce 0.5s ease-out;
  }

  @keyframes bounce {
    0%, 100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-10px);
    }
  }

  h1 {
    color: #2e7d32;
    margin-bottom: 1.5rem;
    font-size: 1.75rem;
  }

  .success-box {
    background: #e8f5e9;
    padding: 2rem;
    border-radius: 4px;
    margin: 2rem 0;
    border: 2px solid #4caf50;
  }

  .success-box p {
    margin: 0.5rem 0;
    color: #333;
    line-height: 1.6;
  }

  .phone-number {
    font-weight: 600;
    font-size: 1.1rem;
    color: #2e7d32;
    margin: 1rem 0 !important;
  }

  .mock-password-box {
    margin-top: 1.5rem;
    padding: 1rem;
    background: #fff3cd;
    border: 2px dashed #ff9800;
    border-radius: 4px;
  }

  .mock-label {
    font-size: 0.9rem;
    color: #856404;
    margin-bottom: 0.5rem !important;
    font-weight: 600;
  }

  .mock-password {
    font-size: 1.5rem;
    font-weight: 700;
    color: #d84315;
    font-family: 'Courier New', monospace;
    letter-spacing: 2px;
    margin: 0.5rem 0 !important;
  }

  .mock-hint {
    font-size: 0.85rem;
    color: #856404;
    font-style: italic;
    margin-top: 0.5rem !important;
  }

  .continue-button {
    padding: 1rem 2rem;
    background: #1976d2;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
    min-width: 200px;
  }

  .continue-button:hover {
    background: #1565c0;
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }

  @media (max-width: 600px) {
    .container {
      padding: 1rem;
    }

    h1 {
      font-size: 1.5rem;
    }

    .success-box {
      padding: 1.5rem;
    }
  }
</style>
