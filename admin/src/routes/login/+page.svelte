<script lang="ts">
  import { supabase } from '$lib/supabase'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'

  let email = $state('')
  let password = $state('')
  let loading = $state(false)
  let error = $state('')
  let isSignUp = $state(false)

  async function handleSubmit(e: Event) {
    e.preventDefault()
    loading = true
    error = ''

    const { error: authError } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      error = authError.message
      loading = false
      return
    }

    if (!isSignUp) {
      goto('/admin')
    } else {
      error = 'Check your email for the confirmation link'
      loading = false
    }
  }
</script>

<svelte:head>
  <title>Login — Admin</title>
</svelte:head>

<div class="login-page">
  <div class="login-card">
    <h1>The Last Generation</h1>
    <p class="login-sub">Admin Dashboard</p>

    {#if error}
      <div class="login-error">{error}</div>
    {/if}

    <form onsubmit={handleSubmit}>
      <div class="form-group">
        <label for="login-email">Email</label>
        <input id="login-email" class="form-input" type="email" bind:value={email} placeholder="you@example.com" required />
      </div>

      <div class="form-group">
        <label for="login-password">Password</label>
        <input id="login-password" class="form-input" type="password" bind:value={password} placeholder="••••••••" required />
      </div>

      <button class="btn btn-primary" type="submit" style="width:100%" disabled={loading}>
        {loading ? 'Signing in…' : isSignUp ? 'Create Account' : 'Sign In'}
      </button>
    </form>

    <p style="text-align:center;margin-top:16px;font-size:var(--fs-xs);color:var(--text-muted)">
      <button class="btn btn-ghost" style="padding:4px" onclick={() => isSignUp = !isSignUp}>
        {isSignUp ? 'Already have an account? Sign in' : 'No account? Create one'}
      </button>
    </p>
  </div>
</div>
