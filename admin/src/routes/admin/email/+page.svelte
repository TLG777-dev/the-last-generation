<script lang="ts">
  import { supabase, isDemo } from '$lib/supabase'
  import { demo } from '$lib/demo'
  import type { Subscriber } from '$lib/types'

  let subscribers = $state<Subscriber[]>([])
  let loading = $state(true)
  let showAddForm = $state(false)
  let newEmail = $state('')
  let newName = $state('')
  let toast = $state('')

  $effect(() => {
    loadSubscribers()
  })

  function showToast(msg: string) {
    toast = msg
    setTimeout(() => toast = '', 3000)
  }

  async function loadSubscribers() {
    loading = true
    if (isDemo) {
      subscribers = demo.getSubscribers()
      loading = false
      return
    }

    const { data } = await supabase!
      .from('subscribers')
      .select('*')
      .order('created_at', { ascending: false })
    subscribers = (data || []) as Subscriber[]
    loading = false
  }

  async function addSubscriber() {
    if (!newEmail) return
    if (isDemo) {
      demo.addSubscriber(newEmail, newName)
      showToast('Subscriber added (demo mode)')
      newEmail = ''
      newName = ''
      showAddForm = false
      loadSubscribers()
      return
    }

    const { error } = await supabase!
      .from('subscribers')
      .insert({ email: newEmail, name: newName || null, status: 'active' })
    if (error) {
      showToast(error.message)
    } else {
      showToast('Subscriber added')
      newEmail = ''
      newName = ''
      showAddForm = false
      loadSubscribers()
    }
  }

  async function removeSubscriber(id: string) {
    if (!confirm('Remove this subscriber?')) return
    if (isDemo) {
      demo.removeSubscriber(id)
      loadSubscribers()
      return
    }
    await supabase!.from('subscribers').delete().eq('id', id)
    loadSubscribers()
  }

  function exportCSV() {
    const headers = 'Email,Name,Status,Created\n'
    const rows = subscribers.map(s =>
      `${s.email},"${s.name || ''}",${s.status},${s.created_at}`
    ).join('\n')
    const blob = new Blob([headers + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'subscribers.csv'
    a.click()
    URL.revokeObjectURL(url)
  }
</script>

<svelte:head>
  <title>Email — Admin</title>
</svelte:head>

<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
  <h3 style="font-family:var(--font-ui);font-size:var(--fs-title);font-weight:500">
    {subscribers.length} subscribers
  </h3>
  <div style="display:flex;gap:8px">
    <button class="btn" onclick={exportCSV}>Export CSV</button>
    <button class="btn btn-primary" onclick={() => showAddForm = !showAddForm}>
      + Add Subscriber
    </button>
  </div>
</div>

{#if showAddForm}
  <div class="card" style="margin-bottom:16px">
    <div style="display:flex;gap:12px;align-items:end">
      <div class="form-group" style="flex:1;margin-bottom:0">
        <label for="sub-email">Email</label>
        <input id="sub-email" class="form-input" type="email" bind:value={newEmail} placeholder="new@example.com" />
      </div>
      <div class="form-group" style="flex:1;margin-bottom:0">
        <label for="sub-name">Name (optional)</label>
        <input id="sub-name" class="form-input" bind:value={newName} placeholder="Name" />
      </div>
      <button class="btn btn-primary" onclick={addSubscriber}>Add</button>
      <button class="btn btn-ghost" onclick={() => showAddForm = false}>Cancel</button>
    </div>
  </div>
{/if}

<div class="card">
  {#if loading}
    <div class="empty-state"><p>Loading subscribers…</p></div>
  {:else if subscribers.length === 0}
    <div class="empty-state">
      <p>No subscribers yet.</p>
      <p style="font-size:var(--fs-xs);margin-top:4px">
        Import your email list or connect Loops.so for automated email campaigns.
      </p>
    </div>
  {:else}
    <table class="data-table">
      <thead>
        <tr>
          <th>Email</th>
          <th>Name</th>
          <th>Status</th>
          <th>Added</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each subscribers as sub}
          <tr>
            <td>{sub.email}</td>
            <td style="color:var(--text-muted)">{sub.name || '—'}</td>
            <td>
              <span class="badge" class:badge-success={sub.status === 'active'} class:badge-danger={sub.status === 'bounced'} class:badge-warning={sub.status === 'unsubscribed'}>
                {sub.status}
              </span>
            </td>
            <td style="font-size:var(--fs-xs);color:var(--text-dim)">
              {new Date(sub.created_at).toLocaleDateString()}
            </td>
            <td>
              <button class="btn btn-ghost" style="padding:4px 8px;font-size:var(--fs-xs)" onclick={() => removeSubscriber(sub.id)}>
                ✕
              </button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

{#if toast}
  <div class="toast-container">
    <div class="toast">{toast}</div>
  </div>
{/if}
