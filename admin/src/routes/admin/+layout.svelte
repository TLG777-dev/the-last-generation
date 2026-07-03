<script lang="ts">
  import { supabase, isDemo } from '$lib/supabase'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import Sidebar from '$lib/components/Sidebar.svelte'

  let { children } = $props()
  let session = $state<any>(null)
  let loading = $state(true)

  $effect(() => {
    if (isDemo) {
      loading = false
      session = { user: { email: 'demo@thelastgeneration.com' } }
      return
    }

    supabase!.auth.getSession().then(({ data }) => {
      session = data.session
      loading = false
      if (!data.session) goto('/login')
    })

    const { data: listener } = supabase!.auth.onAuthStateChange((_event, s) => {
      session = s
      if (!s) goto('/login')
    })

    return () => listener?.subscription.unsubscribe()
  })

  async function signOut() {
    if (isDemo) return
    await supabase!.auth.signOut()
    goto('/login')
  }

  let sidebarOpen = $state(false)
</script>

<svelte:head>
  <title>Admin — The Last Generation</title>
</svelte:head>

{#if loading}
  <div class="login-page">
    <p style="color:var(--text-muted)">Loading…</p>
  </div>
{:else if session || isDemo}
  <link rel="stylesheet" href="/app.css" />
  <div class="app-layout">
    <Sidebar {sidebarOpen} {signOut} onclick={() => sidebarOpen = false} />

    <div class="main-area">
      <header class="topbar">
        <div class="topbar-left">
          <button class="hamburger" onclick={() => sidebarOpen = !sidebarOpen} aria-label="Toggle sidebar">
            <span></span><span></span><span></span>
          </button>
          <h2>
          {#if $page.url.pathname === '/admin'}Dashboard
          {:else if $page.url.pathname.startsWith('/admin/analytics')}Analytics
          {:else if $page.url.pathname.startsWith('/admin/media')}Media Library
          {:else if $page.url.pathname.startsWith('/admin/email')}Email
          {:else}Dashboard
          {/if}
          </h2>
        </div>
        <div class="topbar-right">
          {#if isDemo}
            <span class="badge badge-warning" style="background:rgba(243,156,18,0.15);color:#f39c12">⚡ Demo Mode</span>
          {:else}
            <span class="badge badge-success">Live</span>
          {/if}
          <span style="font-size:var(--fs-xs);color:var(--text-muted)">
            {session?.user?.email || 'demo@thelastgeneration.com'}
          </span>
          <button class="btn btn-ghost" onclick={signOut}>Sign out</button>
        </div>
      </header>

      <main class="page-content">
        {@render children()}
      </main>
    </div>
  </div>
{/if}
