<script lang="ts">
	import { onMount } from 'svelte';
	// MODIFIED: Imported Writable and Readable for strong typing
	import { writable, derived, type Writable, type Readable } from 'svelte/store';
	import { fade, slide } from 'svelte/transition';

	//== TYPESCRIPT INTERFACE ==========================================
	interface Novel {
		id: number;
		title: string;
		author: string;
		synopsis: string;
		tags: string[];
		cover_local_path: string | null;
<<<<<<< HEAD
		// ADDED: Novel cover URL
		cover_url: string | null;
=======
>>>>>>> db8d87f02306025ff7199476f630f4243e3ff1ba
		is_adult: boolean;
		publication_status: '완결' | '연재중';
		chapter_count: number;
		like_count: number;
		source?: string;
	}

	//== STATE MANAGEMENT (SVELTE STORES) ==============================
	const allNovels = writable<Novel[]>([]);
	const error = writable<string | null>(null);
	const isLoading = writable<boolean>(true);
	const query = writable('');
	const authorQuery = writable('');
	const mustHaveTag = writable('');
	const selectedTags = writable<string[]>([]);
	const showAdult = writable<'any' | 'true' | 'false'>('any');
	const status = writable<'' | '완결' | '연재중'>('');
	const minChapters = writable(0);
	const maxChapters = writable(9999);
	const minLikes = writable(0);
	const maxLikes = writable(999999);
	const withCoverOnly = writable(false);
	const sortBy = writable('likes');
	const sortDir = writable('desc');
	const perPage = writable(20);
	const currentPage = writable(1);
	const showFilters = writable(true);
<<<<<<< HEAD
=======
	
>>>>>>> db8d87f02306025ff7199476f630f4243e3ff1ba

	//== AUTOCOMPLETE DATA STORES ==============================
	const allUniqueTags = derived(allNovels, ($allNovels) =>
		[...new Set($allNovels.flatMap((n) => n.tags || []))].sort()
	);
	const allUniqueAuthors = derived(allNovels, ($allNovels) =>
		[...new Set($allNovels.map((n) => n.author))].sort()
	);
	const allUniqueTitles = derived(allNovels, ($allNovels) =>
		[...new Set($allNovels.map((n) => n.title))].sort()
	);

	//== AUTOCOMPLETE SUGGESTION STORES ========================
	const createSuggestionStore = (inputStore: Writable<string>, dataStore: Readable<string[]>) => {
		return derived([inputStore, dataStore], ([$input, $data]) => {
			if (!$input || $input.length < 2) return [];
			const lowercasedInput = $input.toLowerCase();
			return $data.filter((item) => item.toLowerCase().includes(lowercasedInput)).slice(0, 7);
		});
	};

	const titleSuggestions = createSuggestionStore(query, allUniqueTitles);
	const authorSuggestions = createSuggestionStore(authorQuery, allUniqueAuthors);
	const tagSuggestions = createSuggestionStore(mustHaveTag, allUniqueTags);

	//== DERIVED STORES (REACTIVE COMPUTATIONS) ========================
	const topTags = derived(allNovels, ($allNovels) => {
		const tagCounts: Record<string, number> = {};
		for (const novel of $allNovels) {
			for (const tag of novel.tags ?? []) {
				tagCounts[tag] = (tagCounts[tag] || 0) + 1;
			}
		}
		return Object.entries(tagCounts)
			.sort(([, countA], [, countB]) => countB - countA)
			.slice(0, 50)
			.map(([tag]) => tag);
	});
<<<<<<< HEAD

=======
	
>>>>>>> db8d87f02306025ff7199476f630f4243e3ff1ba
	//== DERIVED STORES (REACTIVE COMPUTATIONS) ========================
	const filteredNovels = derived(
		[allNovels, query, authorQuery, mustHaveTag, selectedTags, showAdult, status, minChapters, maxChapters, minLikes, maxLikes, withCoverOnly, sortBy, sortDir],
		([$allNovels, $query, $authorQuery, $mustHaveTag, $selectedTags, $showAdult, $status, $minChapters, $maxChapters, $minLikes, $maxLikes, $withCoverOnly, $sortBy, $sortDir]) => {
			const q = $query.toLowerCase().trim();
			const filtered = $allNovels.filter(novel => {
				const matchesQuery = q === '' || novel.title?.toLowerCase().includes(q) || novel.id?.toString() === q; // Updated to match ID
				const matchesAuthor = $authorQuery === '' || novel.author?.includes($authorQuery);
				const matchesMustHaveTag = !$mustHaveTag || novel.tags?.includes($mustHaveTag);
				const matchesOptionalTags = $selectedTags.length === 0 || $selectedTags.some(tag => novel.tags?.includes(tag));
				const matchesAdult = $showAdult === 'any' || novel.is_adult?.toString() === $showAdult;
				const matchesStatus = $status === '' || novel.publication_status === $status;
				const matchesChapters = novel.chapter_count >= $minChapters && novel.chapter_count <= $maxChapters;
				const matchesLikes = novel.like_count >= $minLikes && novel.like_count <= $maxLikes;
<<<<<<< HEAD
				// MODIFIED: Check for cover_url instead of cover_local_path
				const hasCover = !$withCoverOnly || (novel.cover_url && novel.cover_url.trim() !== '');
				return matchesQuery && matchesAuthor && matchesMustHaveTag && matchesOptionalTags && matchesAdult && matchesStatus && matchesChapters && matchesLikes && hasCover;
			});
=======
				const hasCover = !$withCoverOnly || (novel.cover_local_path && novel.cover_local_path.trim() !== '');

				return matchesQuery && matchesAuthor && matchesMustHaveTag && matchesOptionalTags && matchesAdult && matchesStatus && matchesChapters && matchesLikes && hasCover;
			});

>>>>>>> db8d87f02306025ff7199476f630f4243e3ff1ba
			filtered.sort((a, b) => {
				let result = 0;
				switch ($sortBy) {
					case 'likes': result = b.like_count - a.like_count; break;
					case 'chapters': result = b.chapter_count - a.chapter_count; break;
					case 'title': result = a.title.localeCompare(b.title); break;
				}
				return $sortDir === 'asc' ? -result : result;
			});
			return filtered;
		}
	);

	const pagedNovels = derived(
		[filteredNovels, currentPage, perPage],
		([$filteredNovels, $currentPage, $perPage]) => {
			const start = ($currentPage - 1) * $perPage;
			const end = start + $perPage;
			return $filteredNovels.slice(start, end);
		}
	);
<<<<<<< HEAD
=======
	
>>>>>>> db8d87f02306025ff7199476f630f4243e3ff1ba
	const totalPages = derived([filteredNovels, perPage], ([$filteredNovels, $perPage]) =>
		Math.ceil($filteredNovels.length / $perPage) || 1
	);

	filteredNovels.subscribe(() => {
		currentPage.set(1);
	});
<<<<<<< HEAD

=======
	
>>>>>>> db8d87f02306025ff7199476f630f4243e3ff1ba
	//== LIFECYCLE & FUNCTIONS =========================================
	onMount(async () => {
		try {
			const res = await fetch('/novelpia_metadata.jsonl');
			if (!res.ok) throw new Error(`HTTP error ${res.status}`);
			const text = await res.text();
			const novelsData = text.split('\n').filter(Boolean).map(line => JSON.parse(line));
			allNovels.set(novelsData);
		} catch (err: any) {
			error.set(`Failed to load metadata: ${err.message}.`);
		} finally {
			isLoading.set(false);
		}
	});

	function clearTags() {
		selectedTags.set([]);
		mustHaveTag.set('');
	}

<<<<<<< HEAD
	// MODIFIED: Updated the image error handler to try different file extensions
	function handleCoverError(e: Event) {
		const target = e.target as HTMLImageElement;
		const currentSrc = target.src;
		
		// This flag is used to prevent an infinite loop if both webp and jpg fail
		const hasTriedWebp = currentSrc.includes('.webp');
		const hasTriedJpg = currentSrc.includes('.jpg');

		// Check if the current source is .webp, if so, try .jpg as a fallback
		if (hasTriedWebp && !hasTriedJpg) {
			target.src = currentSrc.replace('.webp', '.jpg');
		} else {
			// If .webp already failed, or the original source didn't contain .webp, or .jpg fails, show the placeholder
=======
	function handleCoverError(e: Event) {
		const target = e.target as HTMLImageElement;
		// Check if the current source is .jpg
		if (target.src.endsWith('.jpg')) {
			// If .jpg fails, try .webp
			target.src = target.src.replace('.jpg', '.webp');
		} else {
			// If .webp also fails, show the placeholder
>>>>>>> db8d87f02306025ff7199476f630f4243e3ff1ba
			if (target.parentElement) {
				target.parentElement.classList.add('no-cover');
			}
			target.style.display = 'none';
		}
	}
	
	function selectSuggestion(store: Writable<string>, value: string) {
		store.set(value);
	}
</script>

<svelte:head>
	<title>Novelpedia Browser</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<main>
	<header>
		<h1>📚 Novelpedia Browser</h1>
		<p class="subtitle">Search and filter through the Novelpia metadata library.</p>
	</header>

	<section class="controls">
		<button class="toggle-filters" on:click={() => showFilters.update((s) => !s)}>
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18"
				><path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z" /></svg
			>
			{$showFilters ? 'Hide Filters' : 'Show Filters'}
		</button>
	</section>

	{#if $showFilters}
		<div class="filter-panel" transition:slide={{ duration: 300 }}>
			<fieldset>
				<div class="autocomplete-wrapper">
					<input type="search" placeholder="Search title or ID..." bind:value={$query} />
					{#if $titleSuggestions.length > 0}
						<ul class="suggestions-list">
							{#each $titleSuggestions as suggestion}
								<li
									role="button"
									tabindex="0"
									on:mousedown={() => selectSuggestion(query, suggestion)}
									on:keydown={(e) => e.key === 'Enter' && selectSuggestion(query, suggestion)}
								>
									{suggestion}
								</li>
							{/each}
						</ul>
					{/if}
				</div>

				<div class="autocomplete-wrapper">
					<input type="search" placeholder="Author name..." bind:value={$authorQuery} />
					{#if $authorSuggestions.length > 0}
						<ul class="suggestions-list">
							{#each $authorSuggestions as suggestion}
								<li
									role="button"
									tabindex="0"
									on:mousedown={() => selectSuggestion(authorQuery, suggestion)}
									on:keydown={(e) => e.key === 'Enter' && selectSuggestion(authorQuery, suggestion)}
								>
									{suggestion}
								</li>
							{/each}
						</ul>
					{/if}
				</div>

				<div class="autocomplete-wrapper">
					<input type="search" placeholder="Must have this tag..." bind:value={$mustHaveTag} />
					{#if $tagSuggestions.length > 0}
						<ul class="suggestions-list">
							{#each $tagSuggestions as suggestion}
								<li
									role="button"
									tabindex="0"
									on:mousedown={() => selectSuggestion(mustHaveTag, suggestion)}
									on:keydown={(e) => e.key === 'Enter' && selectSuggestion(mustHaveTag, suggestion)}
								>
									{suggestion}
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</fieldset>

			<fieldset class="tag-fieldset">
				<legend>Include at least ONE of these tags</legend>
				<div class="tag-container">
					{#each $topTags as tag}
						<label class="tag-checkbox">
							<input type="checkbox" bind:group={$selectedTags} value={tag} />
							<span>{tag}</span>
						</label>
					{/each}
				</div>
				<button class="secondary" on:click={clearTags} disabled={!$mustHaveTag && $selectedTags.length === 0}>Clear Tags</button>
			</fieldset>

			<fieldset class="grid-fieldset">
				<div>
					<label for="min-chapters">Chapters</label>
					<div class="range-inputs">
						<input id="min-chapters" type="number" placeholder="Min" bind:value={$minChapters} />
						<span>-</span>
						<input type="number" placeholder="Max" bind:value={$maxChapters} />
					</div>
				</div>
				<div>
					<label for="min-likes">Likes ❤️</label>
					<div class="range-inputs">
						<input id="min-likes" type="number" placeholder="Min" bind:value={$minLikes} />
						<span>-</span>
						<input type="number" placeholder="Max" bind:value={$maxLikes} />
					</div>
				</div>
				<div>
					<label for="adult-filter">Audience</label>
					<select id="adult-filter" bind:value={$showAdult}>
						<option value="any">Any Audience</option>
						<option value="false">General</option>
						<option value="true">Adult Only</option>
					</select>
				</div>
				<div>
					<label for="status-filter">Status</label>
					<select id="status-filter" bind:value={$status}>
						<option value="">Any Status</option>
						<option value="완결">Completed</option>
						<option value="연재중">Ongoing</option>
					</select>
				</div>
				<div>
					<label for="cover-filter">Cover Art</label>
					<select id="cover-filter" bind:value={$withCoverOnly}>
						<option value={false}>Show All</option>
						<option value={true}>With Cover Only</option>
					</select>
				</div>
			</fieldset>
		</div>
	{/if}

	<section class="results-header">
		<div class="sort-controls">
			<label for="sort-by">Sort by</label>
			<select id="sort-by" bind:value={$sortBy}>
				<option value="likes">Likes</option>
				<option value="chapters">Chapters</option>
				<option value="title">Title</option>
			</select>
			<select bind:value={$sortDir}>
				<option value="desc">Descending</option>
				<option value="asc">Ascending</option>
			</select>
		</div>

		<div class="pagination">
			<button on:click={() => currentPage.update((p) => p - 1)} disabled={$currentPage === 1}>⬅ Prev</button>
			<span>Page {$currentPage} of {$totalPages}</span>
			<button on:click={() => currentPage.update((p) => p + 1)} disabled={$currentPage === $totalPages}>Next ➡</button>
		</div>

		<div class="per-page-controls">
			<select bind:value={$perPage} aria-label="Results per page">
				<option value={20}>20/page</option>
				<option value={50}>50/page</option>
				<option value={100}>100/page</option>
			</select>
		</div>
	</section>

	{#if $isLoading}
		<div class="status-message" transition:fade>
			<div class="spinner"></div>
			<p>Loading novel data...</p>
		</div>
	{:else if $error}
		<div class="status-message error" transition:fade>
			<p>{$error}</p>
		</div>
	{:else if $pagedNovels.length === 0}
		<div class="status-message" transition:fade>
			<p>No novels found matching your criteria.</p>
		</div>
	{:else}
		<div class="grid">
			{#each $pagedNovels as novel (novel.id)}
			<a href={novel.source === 'Novelpia' ? `https://novelpia.com/novel/${novel.id}` : '#'} target="_blank" rel="noopener noreferrer" class="card-link">
				<div class="card" transition:fade>
					<div class="card-cover">
						{#if novel.is_adult}
							<span class="adult-badge">19</span>
						{/if}

						<img
<<<<<<< HEAD
							src={novel.cover_url}
=======
							src={`/novelpia_covers_compressed/${novel.id}.webp`}
>>>>>>> db8d87f02306025ff7199476f630f4243e3ff1ba
							alt="Cover for {novel.title}"
							loading="lazy"
							on:error={handleCoverError}
						/>
						<div class="cover-placeholder">
							<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"
								><path
									d="M4 5h16v11H4V5zm15 13H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1-1zM3 19h18v2H3v-2zM8.5 10.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zM19 14l-4.5-6-3.5 4.5-2-2.5-4 5h14z"
								/></svg
							>
							<span>No Cover</span>
						</div>
					</div>
					<div class="card-content">
						<h2 title={novel.title}>{novel.title}</h2>
						<p class="author">{novel.author}</p>
						<p class="synopsis" title={novel.synopsis}>{novel.synopsis}</p>
						<div class="tags">
							{#each novel.tags?.slice(0, 5) as tag}
								<span class="tag">{tag}</span>
							{/each}
						</div>
						<div class="card-footer">
							<span>{novel.publication_status}</span>
							<span>{novel.chapter_count} Chapters</span>
							<span>❤️ {novel.like_count.toLocaleString()}</span>
						</div>
					</div>
				</div>
				</a>
			{/each}
		</div>

		<div class="pagination bottom">
			<button on:click={() => currentPage.update((p) => p - 1)} disabled={$currentPage === 1}>⬅ Prev</button>
			<span>Page {$currentPage} of {$totalPages}</span>
			<button on:click={() => currentPage.update((p) => p + 1)} disabled={$currentPage === $totalPages}>Next ➡</button>
		</div>
	{/if}
</main>

<style>
	:root {
		--bg-color: #1a1a2e;
		--surface-color: #16213e;
		--primary-color: #0f3460;
		--secondary-color: #e94560;
		--font-color: #e0e0e0;
		--font-color-muted: #a0a0c0;
		--border-color: #303050;
		--radius: 8px;
		--shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		font-family: 'Inter', sans-serif;
	}

	:global(body) {
		margin: 0;
		background-color: var(--bg-color);
		color: var(--font-color);
	}

	main {
		max-width: 1400px;
		margin: 0 auto;
		padding: 2rem;
	}

	header {
		text-align: center;
		margin-bottom: 2rem;
	}

	h1 {
		color: white;
		font-size: 2.5rem;
		font-weight: 700;
	}

	.subtitle {
		font-size: 1.1rem;
		color: var(--font-color-muted);
		margin-top: -1rem;
	}

	section.controls {
		display: flex;
		justify-content: center;
		margin-bottom: 1.5rem;
	}

	.filter-panel {
		background: var(--surface-color);
		padding: 1.5rem 2rem;
		border-radius: var(--radius);
		margin-bottom: 2rem;
		border: 1px solid var(--border-color);
		box-shadow: var(--shadow);
	}

	fieldset {
		border: none;
		padding: 0;
		margin: 0 0 1.5rem 0;
		display: grid;
		gap: 1rem;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
	}
	fieldset:last-child {
		margin-bottom: 0;
	}

	.grid-fieldset {
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
	}

	legend {
		font-weight: 600;
		margin-bottom: 0.75rem;
		font-size: 0.9rem;
		color: var(--font-color-muted);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.range-inputs {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.range-inputs span {
		color: var(--font-color-muted);
	}

	.tag-fieldset {
		display: block;
	}

	.tag-container {
		max-height: 120px;
		overflow-y: auto;
		background: var(--bg-color);
		border-radius: var(--radius);
		padding: 0.75rem;
		border: 1px solid var(--border-color);
		margin-bottom: 1rem;
	}

	.tag-checkbox {
		display: inline-flex;
		align-items: center;
		background: var(--primary-color);
		border-radius: 1rem;
		padding: 4px 4px 4px 10px;
		margin: 4px;
		cursor: pointer;
		transition: background 0.2s ease;
		user-select: none;
	}
	.tag-checkbox:hover {
		background: #1c4a85;
	}
	.tag-checkbox input {
		display: none;
	}
	.tag-checkbox span {
		line-height: 1;
	}
	.tag-checkbox input:checked + span {
		position: relative;
		left: -2px;
	}
	.tag-checkbox input:checked::before {
		content: '✓';
		color: var(--secondary-color);
		font-weight: bold;
		margin-right: 6px;
	}

	.results-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 1rem;
		margin-bottom: 2rem;
		padding: 1rem;
		background: var(--surface-color);
		border-radius: var(--radius);
	}

	.sort-controls,
	.pagination,
	.per-page-controls {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.pagination {
		flex-grow: 1;
		justify-content: center;
	}
	.pagination.bottom {
		margin-top: 2rem;
		justify-content: center;
	}

	input,
	select {
		width: 100%;
		background: var(--bg-color);
		border: 1px solid var(--border-color);
		border-radius: var(--radius);
		padding: 0.75rem;
		color: var(--font-color);
		font-size: 1rem;
		transition:
			border-color 0.2s,
			box-shadow 0.2s;
		box-sizing: border-box;
	}
	input:focus,
	select:focus {
		outline: none;
		border-color: var(--secondary-color);
		box-shadow: 0 0 0 3px rgba(233, 69, 96, 0.3);
	}

	button {
		background: var(--primary-color);
		color: white;
		border: none;
		padding: 0.75rem 1.25rem;
		border-radius: var(--radius);
		font-weight: 600;
		cursor: pointer;
		transition:
			background-color 0.2s,
			transform 0.1s;
	}
	button:hover {
		background: #1c4a85;
	}
	button:active {
		transform: scale(0.98);
	}
	button:disabled {
		background: var(--border-color);
		color: var(--font-color-muted);
		cursor: not-allowed;
	}
	button.secondary {
		background: transparent;
		border: 1px solid var(--border-color);
		color: var(--font-color);
	}
	button.secondary:hover:not(:disabled) {
		background: var(--border-color);
	}
	button.toggle-filters {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		background: var(--primary-color);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 1.5rem;
	}
	.card {
		background: var(--surface-color);
		border-radius: var(--radius);
		overflow: hidden;
		display: flex;
		flex-direction: column;
		border: 1px solid var(--border-color);
		transition:
			transform 0.2s ease-in-out,
			box-shadow 0.2s ease-in-out;
		box-shadow: var(--shadow);
	}
	.card:hover {
		transform: translateY(-5px);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
	}

	.card-cover {
		position: relative;
		aspect-ratio: 2 / 3;
		background-color: #000;
	}
	.card-cover img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.cover-placeholder {
		display: none;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		color: var(--font-color-muted);
	}
	.cover-placeholder svg {
		width: 50px;
		height: 50px;
	}
	.cover-placeholder span {
		margin-top: 0.5rem;
	}

	/* svelte-ignore css-unused-selector */
	.no-cover .cover-placeholder {
		display: flex;
	}

	.card-content {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		flex-grow: 1;
	}
	.card-content h2 {
		font-size: 1.2rem;
		margin: 0 0 0.25rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.card-content .author {
		font-size: 0.9rem;
		color: var(--font-color-muted);
		margin: 0 0 1rem;
	}

	.synopsis {
		font-size: 0.9rem;
		line-height: 1.5;
		color: var(--font-color-muted);
		margin: 0 0 1rem;
		flex-grow: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 3;
		line-clamp: 3;
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}
	.tag {
		background-color: var(--primary-color);
		color: var(--font-color);
		padding: 0.25rem 0.6rem;
		border-radius: 1rem;
		font-size: 0.75rem;
	}

	.card-footer {
		display: flex;
		justify-content: space-between;
		font-size: 0.8rem;
		color: var(--font-color-muted);
		border-top: 1px solid var(--border-color);
		padding-top: 0.75rem;
		margin-top: auto;
	}

	.status-message {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4rem 2rem;
		text-align: center;
		color: var(--font-color-muted);
	}
	.status-message.error {
		color: var(--secondary-color);
	}

	.spinner {
		border: 4px solid var(--border-color);
		border-top: 4px solid var(--secondary-color);
		border-radius: 50%;
		width: 40px;
		height: 40px;
		animation: spin 1s linear infinite;
		margin-bottom: 1rem;
	}
	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	.autocomplete-wrapper {
		position: relative;
	}

	.suggestions-list {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		background: var(--surface-color);
		border: 1px solid var(--border-color);
		border-top: none;
		border-radius: 0 0 var(--radius) var(--radius);
		margin: 0;
		padding: 0;
		list-style: none;
		z-index: 100;
		max-height: 250px;
		overflow-y: auto;
		box-shadow: var(--shadow);
	}

	.suggestions-list li {
		padding: 0.75rem;
		cursor: pointer;
		border-bottom: 1px solid var(--border-color);
	}
	.suggestions-list li:last-child {
		border-bottom: none;
	}

	.suggestions-list li:hover {
		background-color: var(--primary-color);
	}

	.card-link {
		text-decoration: none;
		color: inherit;
	}
	.card-link:hover .card {
		transform: translateY(-5px);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
	}

	/* ADDED: R19 Badge Style */
	.adult-badge {
		position: absolute;
		top: 8px;
		right: 8px;
		background-color: var(--secondary-color);
		color: white;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.8rem;
		font-weight: 700;
		border: 2px solid white;
		z-index: 5;
		user-select: none;
	}
</style>