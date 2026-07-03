<script lang="ts">
  import { supabase, isDemo } from '$lib/supabase'
  import { demo } from '$lib/demo'
  import type { MediaItem } from '$lib/types'

  let files = $state<MediaItem[]>([])
  let loading = $state(true)
  let uploading = $state(false)
  let toast = $state('')

  $effect(() => {
    loadFiles()
  })

  function showToast(msg: string) {
    toast = msg
    setTimeout(() => toast = '', 3000)
  }

  async function loadFiles() {
    loading = true
    if (isDemo) {
      files = demo.getMedia()
      loading = false
      return
    }

    const { data } = await supabase!.storage.from('media').list('', {
      sortBy: { column: 'created_at', order: 'desc' }
    })
    if (data) {
      files = data.map(f => ({
        id: f.id || f.name,
        name: f.name,
        url: supabase!.storage.from('media').getPublicUrl(f.name).data.publicUrl,
        size: f.metadata?.size || 0,
        type: f.metadata?.mimetype || '',
        created_at: f.created_at || '',
      }))
    }
    loading = false
  }

  async function upload(e: Event) {
    const input = e.target as HTMLInputElement
    if (!input.files?.length) return

    if (isDemo) {
      const file = input.files[0]
      demo.addMedia({ name: file.name, type: file.type, size: file.size })
      showToast('Uploaded (demo mode — file not persisted)')
      loadFiles()
      input.value = ''
      return
    }

    uploading = true
    const file = input.files[0]
    const path = `${Date.now()}-${file.name}`

    const { error } = await supabase!.storage.from('media').upload(path, file)
    if (error) {
      showToast(error.message)
    } else {
      showToast('Uploaded successfully')
    }
    uploading = false
    loadFiles()
    input.value = ''
  }

  async function removeFile(name: string) {
    if (!confirm(`Delete "${name}"?`)) return
    if (isDemo) {
      demo.removeMedia(name)
      showToast('Deleted (demo mode)')
      loadFiles()
      return
    }
    const { error } = await supabase!.storage.from('media').remove([name])
    if (error) {
      showToast(error.message)
    } else {
      showToast('Deleted')
    }
    loadFiles()
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / 1048576).toFixed(1) + ' MB'
  }

  async function copyUrl(url: string) {
    await navigator.clipboard.writeText(url)
    showToast('URL copied')
  }
</script>

<svelte:head>
  <title>Media — Admin</title>
</svelte:head>

<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
  <h3 style="font-family:var(--font-ui);font-size:var(--fs-title);font-weight:500">{files.length} files</h3>
  <label class="btn btn-primary" style="cursor:pointer">
    {uploading ? 'Uploading…' : '+ Upload'}
    <input type="file" hidden onchange={upload} accept="image/*,.svg,.webp" />
  </label>
</div>

{#if loading}
  <div class="empty-state"><p>Loading media…</p></div>
{:else if files.length === 0}
  <div class="empty-state">
    <p>No media uploaded yet.</p>
    <p style="font-size:var(--fs-xs);margin-top:4px">Upload images for product listings or site assets.</p>
  </div>
{:else}
  <div class="media-grid">
    {#each files as file}
      <button type="button" class="media-item" onclick={() => copyUrl(file.url)} title="Click to copy URL" onkeydown={(e) => e.key === 'Enter' && copyUrl(file.url)}>
        {#if file.type.startsWith('image/') || file.url.includes('placehold.co')}
          <img src={file.url} alt={file.name} loading="lazy" />
        {:else}
          <div style="width:100%;aspect-ratio:4/3;display:flex;align-items:center;justify-content:center;background:var(--bg);color:var(--text-dim);font-size:var(--fs-xs)">
            {file.type || 'Unknown'}
          </div>
        {/if}
        <div class="media-info" style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div class="media-name">{file.name}</div>
            <div class="media-size">{formatSize(file.size)}</div>
          </div>
          <span role="button" tabindex="0" class="btn btn-ghost" style="padding:4px 8px;font-size:var(--fs-xs)" onclick={(e) => { e.stopPropagation(); removeFile(file.name) }} onkeydown={(e) => e.key === 'Enter' && (e.stopPropagation(), removeFile(file.name))}>
            ✕
          </span>
        </div>
      </button>
    {/each}
  </div>
{/if}

{#if toast}
  <div class="toast-container">
    <div class="toast">{toast}</div>
  </div>
{/if}
