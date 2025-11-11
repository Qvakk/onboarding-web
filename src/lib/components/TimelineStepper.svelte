<script>
  export let steps = ["Start", "Profile", "Finish"];
  export let currentStep = 0; // 0-based index

  // Helper to check if a step is completed
  const isCompleted = idx => idx < currentStep;
  // Helper to check if a step is active
  const isActive = idx => idx === currentStep;
  // Helper to check if a step is the last
  const isLast = idx => idx === steps.length - 1;
</script>

<div class="timeline-stepper">
  {#each steps as label, idx}
    <div class="step {isCompleted(idx) ? 'completed' : isActive(idx) ? 'active' : ''}">
      <div class="circle">
        {#if isCompleted(idx)}
          <span>&nbsp;</span>
        {:else}
          {idx + 1}
        {/if}
      </div>
      <div class="label">{label}</div>
    </div>
    {#if idx < steps.length - 1}
      <div class="line"></div>
    {/if}
  {/each}
</div>

<style>
.timeline-stepper {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 2rem;
  padding: 1rem 6rem 2rem 6rem;
}
.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 60px;
}
.circle {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #f5f5f5; 
  color: #444;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  margin-bottom: 0.5rem;
  border: 2px solid #444; 
  transition: background 0.3s, color 0.3s, border 0.3s;
}
.step.completed .circle,
.step.active .circle {
  background: var(--spinner-color, #01725d);
  color: #fff;
  border-color: var(--spinner-color, #01725d);
}

.label {
  font-size: 0.9rem;
  color: #444;
  text-align: center;
}
.step.completed .label,
.step.active .label {
  color: var(--spinner-color, #01725d);
}
.line {
  flex: 1 1 0;
  height: 2px;
  background: #ccc;
  align-self: center;
  margin: 0 0.5rem;
  min-width: 32px;
  position: relative;
  top: -10px; 
}
.step.completed + .line {
  background: var(--spinner-color, #01725d);
}
@media (max-width: 600px) {
  .timeline-stepper {
    flex-direction: row;
    gap: 1rem;
    overflow-x: auto;
    padding: 1rem 0 1rem 0;
  }
  .step {
    min-width: 48px;
  }
  .circle {
    width: 28px;
    height: 28px;
    font-size: 1rem;
  }
  .line {
    min-width: 20px;
    height: 2px;
  }
}

/* Extra small screens: hide labels, shrink circles and gap, shrink lines */
@media (max-width: 500px) {
  .timeline-stepper {
    gap: 0.5rem;
  }
  .label {
    display: none;
  }
  .circle {
    width: 22px;
    height: 22px;
    font-size: 0.9rem;
  }
  .line {
    min-width: 8px;
    height: 1.5px;
    top: -4px; 
  }
}
</style>
