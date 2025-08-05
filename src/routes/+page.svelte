<script lang="ts">
	import { onMount } from 'svelte';
	import { writable, derived, get, type Writable, type Readable } from 'svelte/store';
	import { fade, slide } from 'svelte/transition';
	import { base } from '$app/paths';

	//== TYPESCRIPT INTERFACE ==========================================
	interface Novel {
		id: number;
		title: string;
		author: string;
		synopsis: string;
		tags: string[];
		cover_local_path: string | null;
		cover_url: string | null;
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

	let jumpToPage: number | null = null;
	// Refs for input elements to manage focus/blur for autocomplete
	let queryInput: HTMLInputElement;
	let authorQueryInput: HTMLInputElement;
	let mustHaveTagInput: HTMLInputElement;

	// Timeout for blur event to allow click on suggestion.
	let blurTimeout: number;

	//== AUTOCOMPLETE DATA STORES ==============================
	const allUniqueAuthors = derived(allNovels, ($allNovels) =>
		[...new Set($allNovels.map((n) => n.author))].sort()
	);
	const allUniqueTitles = derived(allNovels, ($allNovels) =>
		[...new Set($allNovels.map((n) => n.title))].sort()
	);
	
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
	
	//== AUTOCOMPLETE SUGGESTION STORES ========================
	const createSuggestionStore = (
		inputStore: Writable<string>,
		dataStore: Readable<string[]>,
		popularityMap: Readable<Record<string, number>> = writable<Record<string, number>>({})
	) => {
		return derived([inputStore, dataStore, popularityMap], ([$input, $data, $popularityMap]) => {
			const trimmedInput = $input.trim();
			if (!trimmedInput || trimmedInput.length < 2) return [];

			const lowercasedInput = trimmedInput.toLowerCase();
			const filtered = $data.filter((item) => item.toLowerCase().includes(lowercasedInput));

			filtered.sort((a, b) => {
				const aLower = a.toLowerCase();
				const bLower = b.toLowerCase();

				const aStarts = aLower.startsWith(lowercasedInput);
				const bStarts = bLower.startsWith(lowercasedInput);

				// Prioritize suggestions that start with the input
				if (aStarts && !bStarts) return -1;
				if (!aStarts && bStarts) return 1;

				// Then, sort by popularity if available
				if (popularityMap) {
					const popA = $popularityMap[a] || 0;
					const popB = $popularityMap[b] || 0;
					if (popA !== popB) return popB - popA;
				}

				// Finally, sort alphabetically
				return aLower.localeCompare(bLower);
			});

			return filtered.slice(0, 7);
		});
	};
	const titleSuggestions = createSuggestionStore(query, allUniqueTitles);
	const authorSuggestions = createSuggestionStore(authorQuery, allUniqueAuthors);
	// Create a popularity map for tags for sorting suggestions
	const tagPopularityMap = derived(allNovels, ($allNovels) => {
		const tagCounts: Record<string, number> = {};
		for (const novel of $allNovels) {
			for (const tag of novel.tags ?? []) {
				tagCounts[tag] = (tagCounts[tag] || 0) + 1;
			}
		}
		return tagCounts;
	});
	const allUniqueTags = derived(allNovels, ($allNovels) =>
		[...new Set($allNovels.flatMap((n) => n.tags || []))].sort()
	);
	const tagSuggestions = createSuggestionStore(mustHaveTag, allUniqueTags, tagPopularityMap);

	//== DERIVED STORES (REACTIVE COMPUTATIONS) ========================
	const filteredNovels = derived(
		[allNovels, query, authorQuery, mustHaveTag, selectedTags, showAdult, status, minChapters, maxChapters, minLikes, maxLikes, withCoverOnly, sortBy, sortDir],
		([$allNovels, $query, $authorQuery, $mustHaveTag, $selectedTags, $showAdult, $status, $minChapters, $maxChapters, $minLikes, $maxLikes, $withCoverOnly, $sortBy, $sortDir]) => {
			const q = $query.toLowerCase().trim();
			const filtered = $allNovels.filter(novel => {
				const matchesQuery = q === '' || novel.title?.toLowerCase().includes(q) || novel.id?.toString() === q;
				const matchesAuthor = $authorQuery === '' || novel.author?.toLowerCase().includes($authorQuery.toLowerCase());
				const sanitizedMustHaveTag = $mustHaveTag.replace(/^#/, '').toLowerCase();
				const matchesMustHaveTag = !sanitizedMustHaveTag || novel.tags?.some(tag => tag.toLowerCase() === sanitizedMustHaveTag);
				const matchesOptionalTags = $selectedTags.length === 0 || $selectedTags.some(selectedTag => novel.tags?.some(novelTag => novelTag.toLowerCase() === selectedTag.toLowerCase()));
				const matchesAdult = $showAdult === 'any' || novel.is_adult?.toString() === $showAdult;
				const matchesStatus = $status === '' || novel.publication_status === $status;
				const matchesChapters = novel.chapter_count >= $minChapters && novel.chapter_count <= $maxChapters;
				const matchesLikes = novel.like_count >= $minLikes && novel.like_count <= $maxLikes;
				const hasCover = !$withCoverOnly || (novel.cover_url && novel.cover_url.trim() !== '');
				
				return matchesQuery && matchesAuthor && matchesMustHaveTag && matchesOptionalTags && matchesAdult && matchesStatus && matchesChapters && matchesLikes && hasCover;
			});
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
	const totalPages = derived([filteredNovels, perPage], ([$filteredNovels, $perPage]) =>
		Math.ceil($filteredNovels.length / $perPage) || 1
	);

	filteredNovels.subscribe(() => {
		currentPage.set(1);
	});

	//== LIFECYCLE & FUNCTIONS =========================================
	onMount(async () => {
		try {
			const res = await fetch(`${base}/novelpia_metadata.jsonl`);
			if (!res.ok) throw new Error(`HTTP error ${res.status}`);
			const text = await res.text();
			const novelsData = text.split('\n').filter(Boolean).map(line => {
				const novel = JSON.parse(line);
				if (novel.tags) {
					novel.tags = novel.tags.map((tag: string) => String(tag).startsWith('#') ? String(tag).substring(1) : String(tag));
				}
				return novel;
			});
			allNovels.set(novelsData);
		} catch (err: any) {
			error.set(`Failed to load metadata: ${err.message}.`);
			console.error('Failed to load metadata:', err);
		} finally {
			isLoading.set(false);
		}
	});

	function clearTags() {
		selectedTags.set([]);
		mustHaveTag.set('');
	}

	function goToPage() {
		if (jumpToPage && jumpToPage > 0 && jumpToPage <= $totalPages) {
			currentPage.set(jumpToPage);
		}
		const inputElem = document.querySelector('.pagination-input input') as HTMLInputElement;
		if (inputElem) inputElem.value = '';
		jumpToPage = null;
	}

	let customMessage = writable<string | null>(null);
	function showCustomMessage(message: string) {
		customMessage.set(message);
		setTimeout(() => customMessage.set(null), 3000);
	}

	function exportFilteredNovels() {
		const novelsToExport = get(filteredNovels);

		if (novelsToExport.length === 0) {
			showCustomMessage('No novels found matching your criteria to export.');
			return;
		}

		const content = novelsToExport
			.map(novel => `${novel.title}, ${novel.id}`)
			.join('\n');

		const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'filtered_novels.txt';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	function handleCoverError(e: Event) {
		const target = e.target as HTMLImageElement;
		const currentSrc = target.src;
		
		const hasTriedWebp = currentSrc.includes('.webp');
		const hasTriedJpg = currentSrc.includes('.jpg');

		if (hasTriedWebp && !hasTriedJpg) {
			target.src = currentSrc.replace('.webp', '.jpg');
		} else {
			if (target.parentElement) {
				target.parentElement.classList.add('no-cover');
			}
			target.style.display = 'none';
		}
	}
	
	function selectSuggestion(store: Writable<string>, value: string, inputRef: HTMLInputElement) {
		store.set(value);
		inputRef.blur();
	}

	function handleBlurWithTimeout(inputRef: HTMLInputElement) {
		clearTimeout(blurTimeout);
		blurTimeout = setTimeout(() => {
			if (document.activeElement !== inputRef) {
				// This block can be used for any logic that should happen after blur,
				// but only if focus hasn't moved to another element within the autocomplete.
			}
		}, 150);
	}

	function handleFocus() {
		clearTimeout(blurTimeout);
	}
</script>

<svelte:head>
	<title>Novelpedia Browser</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link rel="stylesheet" href="{base}/styles.css" />
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
					<input
						type="search"
						placeholder="Search title or ID..."
						bind:value={$query}
						bind:this={queryInput}
						on:focus={handleFocus}
						on:blur={() => handleBlurWithTimeout(queryInput)}
					/>
					{#if $titleSuggestions.length > 0 && queryInput === document.activeElement}
						<ul class="suggestions-list">
							{#each $titleSuggestions as suggestion}
								<li>
									<button
										class="suggestion-button"
										on:click={() => selectSuggestion(query, suggestion, queryInput)}
									>
										{suggestion}
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</div>

				<div class="autocomplete-wrapper">
					<input
						type="search"
						placeholder="Author name..."
						bind:value={$authorQuery}
						bind:this={authorQueryInput}
						on:focus={handleFocus}
						on:blur={() => handleBlurWithTimeout(authorQueryInput)}
					/>
					{#if $authorSuggestions.length > 0 && authorQueryInput === document.activeElement}
						<ul class="suggestions-list">
							{#each $authorSuggestions as suggestion}
								<li>
									<button
										class="suggestion-button"
										on:click={() => selectSuggestion(authorQuery, suggestion, authorQueryInput)}
									>
										{suggestion}
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</div>

				<div class="autocomplete-wrapper">
					<input
						type="search"
						placeholder="Must have this tag..."
						bind:value={$mustHaveTag}
						bind:this={mustHaveTagInput}
						on:focus={handleFocus}
						on:blur={() => handleBlurWithTimeout(mustHaveTagInput)}
					/>
					{#if $tagSuggestions.length > 0 && mustHaveTagInput === document.activeElement}
						<ul class="suggestions-list">
							{#each $tagSuggestions as suggestion}
								<li>
									<button
										class="suggestion-button"
										on:click={() => selectSuggestion(mustHaveTag, suggestion, mustHaveTagInput)}
									>
										{suggestion}
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</fieldset>

			<fieldset class="tag-fieldset">
				<legend>Include at least ONE of these tags</legend>
				<div class="tag-container">
					{#if $topTags.length === 0}
						<p>Loading tags...</p>
					{:else}
						{#each $topTags as tag: string}
							<label class="tag-checkbox" class:selected={$selectedTags.includes(tag)}>
								<input type="checkbox" bind:group={$selectedTags} value={tag} />
								<span>{tag}</span>
							</label>
						{/each}
					{/if}
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

		<button class="secondary" on:click={exportFilteredNovels} title="Export current filtered results to a .txt file">
			Export Filtered
		</button>
		</div>

		<div class="pagination">
    <button on:click={() => currentPage.update((p) => p - 1)} disabled={$currentPage === 1}>⬅ Prev</button>

    <div class="pagination-input">
        <span>Page</span>
        <input 
            type="number" 
            bind:value={jumpToPage}
            placeholder={$currentPage.toString()}
            on:keydown={(e) => e.key === 'Enter' && goToPage()}
            min="1"
            max={$totalPages}
            aria-label="Jump to page"
        />
        <span>of {$totalPages}</span>
        <button on:click={goToPage} class="secondary">Go</button>
    </div>

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

	{#if $customMessage}
		<div class="custom-message" transition:fade>
			<p>{$customMessage}</p>
		</div>
	{/if}

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
							src={novel.cover_url}
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
							{#if novel.tags}
								{#each novel.tags as tag: string}
									<button
										class="tag clickable"
										on:click|preventDefault={() => mustHaveTag.set(tag)}
									>
										{tag}
									</button>
								{/each}
							{/if}
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

    <div class="pagination-input">
        <span>Page</span>
        <input 
            type="number" 
            bind:value={jumpToPage}
            placeholder={$currentPage.toString()}
            on:keydown={(e) => e.key === 'Enter' && goToPage()}
            min="1"
            max={$totalPages}
            aria-label="Jump to page"
        />
        <span>of {$totalPages}</span>
        <button on:click={goToPage} class="secondary">Go</button>
    </div>

    <button on:click={() => currentPage.update((p) => p + 1)} disabled={$currentPage === $totalPages}>Next ➡</button>
		</div>
	{/if}
</main>
