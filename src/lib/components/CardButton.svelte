<script>
    import { goto } from '$app/navigation'
    import IconSpinner from './Icons/IconSpinner.svelte'
    import { t } from 'svelte-i18n';
    
    export let header = ''
    export let imgPath = ''
    export let imgAlt = 'alt'
    export let gotoPath = 'urlPath'
    export let paragraph = 'some text'
    export let boolValue = false
    export let loading = false
    export let func = () => {} // Default empty function

    const handleClick = () => {
        if (boolValue) {
            goto(gotoPath)
        } else {
            func()
        }
    }
</script>

<button on:click={handleClick} class="card">
    {#if loading}
        <div class="loadingSpinner">
            <IconSpinner width="80px"/>
        </div>
    {:else}
        <img src={imgPath} alt={imgAlt}/>
    {/if}
    <div class="container">
        <h2>
          <b>{header}</b>
        </h2>
        <p>{paragraph}</p>
    </div>
</button>

<style>
.card img {
  width: 120px;
  height: 120px;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  display: block;
  margin: 0 auto 1.5rem auto;
}

/* Center the loading spinner inside the card */
.loadingSpinner {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 120px;
  margin-bottom: 1.5rem;
}

/* Smaller cards on small screens (height <= 800px) */
@media only screen and (max-height: 800px) {
  .card img {
    width: 80px;
    height: 80px;
    margin: 0 auto 1rem auto;
  }
  
  .loadingSpinner {
    min-height: 80px;
    margin-bottom: 1rem;
  }
}
</style>