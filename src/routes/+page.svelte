<script lang="ts">
    import { onMount } from 'svelte';
    import { writable, derived, get, type Writable, type Readable } from 'svelte/store';
    import { fade, slide } from 'svelte/transition';
    import { base } from '$app/paths';

    //== TYPESCRIPT INTERFACE ==========================================
    interface Novel {
        id: number | string;
        title: string;
        author: string;
        synopsis: string;
        tags: string[];
        cover_local_path: string | null;
        cover_url: string | null;
        large_cover_url?: string | null; 
        is_adult: boolean;
        publication_status: '완결' | '연재중';
        chapter_count: number;
        like_count: number;
        views?: number; 
        source?: string;
        time_scraped?: string;
    }

    //== STATE MANAGEMENT (SVELTE STORES) ==============================
    const allNovels = writable<Novel[]>([]);
    const error = writable<string | null>(null);
    const isLoading = writable<boolean>(true);
    const query = writable('');
    const authorQuery = writable('');
    const mustHaveTag = writable('');
    const selectedTags = writable<string[]>([]);

    const excludedTags = writable<string[]>([]);
    const excludeTagQuery = writable('');
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
    const sourceFilter = writable<'' | 'Novelpia' | 'kakao' | 'sfacg'>('');

    let jumpToPage: number | null = null;
    // Refs for input elements to manage focus/blur for autocomplete
    let queryInput: HTMLInputElement;
    let authorQueryInput: HTMLInputElement;
    let mustHaveTagInput: HTMLInputElement;
    //== ADDED: Ref for the new exclude tag input
    let excludeTagInput: HTMLInputElement;


    // Timeout for blur event to allow click on suggestion.
    let blurTimeout: number;

    //== DERIVED STORES (REACTIVE COMPUTATIONS) ========================

    // This derived store holds novels filtered ONLY by source, for tag generation
    const sourceFilteredNovels = derived(
        [allNovels, sourceFilter],
        ([$allNovels, $sourceFilter]) => {
            if ($sourceFilter === '') {
                return $allNovels;
            }
            return $allNovels.filter(novel => novel.source === $sourceFilter);
        }
    );

    // These autocomplete data stores now depend on the sourceFilteredNovels
    // so that tag suggestions are only based on the selected source.
    const allUniqueAuthors = derived(allNovels, ($allNovels) => // Authors still based on all novels for broader search
        [...new Set($allNovels.map((n) => n.author))].sort()
    );
    const allUniqueTitles = derived(allNovels, ($allNovels) => // Titles still based on all novels for broader search
        [...new Set($allNovels.map((n) => n.title))].sort()
    );
    
    const topTags = derived(sourceFilteredNovels, ($sourceFilteredNovels) => {
        const tagCounts: Record<string, number> = {};
        for (const novel of $sourceFilteredNovels) {
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

    // Create a popularity map for tags for sorting suggestions (now based on sourceFilteredNovels)
    const tagPopularityMap = derived(sourceFilteredNovels, ($sourceFilteredNovels) => {
        const tagCounts: Record<string, number> = {};
        for (const novel of $sourceFilteredNovels) {
            for (const tag of novel.tags ?? []) {
                tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            }
        }
        return tagCounts;
    });

    const allUniqueTags = derived(sourceFilteredNovels, ($sourceFilteredNovels) =>
        [...new Set($sourceFilteredNovels.flatMap((n) => n.tags || []))].sort()
    );

    const titleSuggestions = createSuggestionStore(query, allUniqueTitles);
    const authorSuggestions = createSuggestionStore(authorQuery, allUniqueAuthors);
    const tagSuggestions = createSuggestionStore(mustHaveTag, allUniqueTags, tagPopularityMap);

    const excludeTagSuggestions = createSuggestionStore(excludeTagQuery, allUniqueTags, tagPopularityMap);


    // The main filtered novels list, which considers ALL filters

    const filteredNovels = derived(
        [allNovels, query, authorQuery, mustHaveTag, selectedTags, excludedTags, showAdult, status, minChapters, maxChapters, minLikes, maxLikes, withCoverOnly, sortBy, sortDir, sourceFilter],
        ([$allNovels, $query, $authorQuery, $mustHaveTag, $selectedTags, $excludedTags, $showAdult, $status, $minChapters, $maxChapters, $minLikes, $maxLikes, $withCoverOnly, $sortBy, $sortDir, $sourceFilter]) => {
            const q = $query.toLowerCase().trim();
            const filtered = $allNovels.filter(novel => {
                // Ensure novel.id is treated as string for comparison with query
                const matchesQuery = q === '' || novel.title?.toLowerCase().includes(q) || String(novel.id) === q;
                const matchesAuthor = $authorQuery === '' || novel.author?.toLowerCase().includes($authorQuery.toLowerCase());
                const sanitizedMustHaveTag = $mustHaveTag.replace(/^#/, '').toLowerCase();
                const matchesMustHaveTag = !sanitizedMustHaveTag || novel.tags?.some(tag => tag.toLowerCase() === sanitizedMustHaveTag);
                const matchesOptionalTags = $selectedTags.length === 0 || $selectedTags.some(selectedTag => novel.tags?.some(novelTag => novelTag.toLowerCase() === selectedTag.toLowerCase()));
                
                
                const lowerCaseNovelTags = novel.tags?.map(t => t.toLowerCase()) ?? [];
                const matchesExcludedTags = !$excludedTags.some(excludedTag => lowerCaseNovelTags.includes(excludedTag.toLowerCase()));

                const matchesAdult = $showAdult === 'any' || novel.is_adult?.toString() === $showAdult;
                const matchesStatus = $status === '' || novel.publication_status === $status;
                // Use default 0 if chapter_count or like_count are undefined for filtering
                const matchesChapters = (novel.chapter_count ?? 0) >= $minChapters && (novel.chapter_count ?? 0) <= $maxChapters;
                const matchesLikes = (novel.like_count ?? 0) >= $minLikes && (novel.like_count ?? 0) <= $maxLikes;
                const hasCover = !$withCoverOnly || (novel.cover_url && novel.cover_url.trim() !== '');
                // Filter for source
                const matchesSource = $sourceFilter === '' || novel.source === $sourceFilter;
                
                

        
                return matchesQuery && matchesAuthor && matchesMustHaveTag && matchesOptionalTags && matchesExcludedTags && matchesAdult && matchesStatus && matchesChapters && matchesLikes && hasCover && matchesSource;
            });
            filtered.sort((a, b) => {
                let result = 0;
                switch ($sortBy) {
                    // Use default 0 if chapter_count, like_count, or views are undefined for sorting
                    case 'likes': result = (b.like_count ?? 0) - (a.like_count ?? 0); break;
                    case 'chapters': result = (b.chapter_count ?? 0) - (a.chapter_count ?? 0); break;
                    case 'views': result = (b.views ?? 0) - (a.views ?? 0); break; // Sort by views
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
            // Fetch Novelpia data
            const novelpiaRes = await fetch(`${base}/novelpia_metadata.jsonl`);
            console.log(`Fetching Novelpia data from ${base}/novelpia_metadata.jsonl`);
            if (!novelpiaRes.ok) throw new Error(`HTTP error ${novelpiaRes.status} for Novelpia data`);
            const novelpiaText = await novelpiaRes.text();
            const novelpiaNovels: Novel[] = novelpiaText.split('\n').filter(Boolean).map(line => {
                const novel = JSON.parse(line);
                if (novel.tags) {
                    novel.tags = novel.tags.map((tag: string) => String(tag).startsWith('#') ? String(tag).substring(1) : String(tag));
                }
                // Assign 'Novelpia' as source if not already present
                novel.source = novel.source || 'Novelpia'; 
                novel.views = novel.views ?? 0; // Default views for Novelpia
                return novel;
            });

            // Fetch Kakao novels data
            const kakaoRes = await fetch(`${base}/kakao_novels.jsonl`);
            if (!kakaoRes.ok) throw new Error(`HTTP error ${kakaoRes.status} for Kakao data`);
            const kakaoText = await kakaoRes.text();
            const kakaoNovels: Novel[] = kakaoText.split('\n').filter(Boolean).map(line => {
                const novel = JSON.parse(line);
                if (novel.tags) {
                    novel.tags = novel.tags.map((tag: string) => String(tag).startsWith('#') ? String(tag).substring(1) : String(tag));
                }
                // Kakao novels should already have source: 'kakao' from the provided data format
                novel.chapter_count = novel.chapter_count ?? 0; // Ensure chapter_count is number
                novel.like_count = novel.like_count ?? 0; // Ensure like_count is number
                novel.views = novel.views ?? 0; // Default views for Kakao
                return novel;
            });

            // Fetch SFACG novels data
            const sfacgRes = await fetch(`${base}/sfacg_novels.jsonl`);
            if (!sfacgRes.ok) throw new Error(`HTTP error ${sfacgRes.status} for SFACG data`);
            const sfacgText = await sfacgRes.text();
            const sfacgNovels: Novel[] = sfacgText.split('\n').filter(Boolean).map(line => {
                const novel = JSON.parse(line);
                if (novel.tags) {
                    novel.tags = novel.tags.map((tag: string) => String(tag).startsWith('#') ? String(tag).substring(1) : String(tag));
                }
                // SFACG data might not have chapter_count or like_count, default to 0
                novel.chapter_count = novel.chapter_count ?? 0;
                novel.like_count = novel.like_count ?? 0;
                novel.views = novel.views ?? 0; // Default views for SFACG
                return novel;
            });

            // Combine all novels
            allNovels.set([...novelpiaNovels, ...kakaoNovels, ...sfacgNovels]);

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
        excludedTags.set([]);
    }
    
   
    function addExcludedTag(tag: string) {
        const cleanTag = tag.trim().toLowerCase();
        if (cleanTag && !get(excludedTags).includes(cleanTag)) {
            excludedTags.update(current => [...current, cleanTag]);
        }
        excludeTagQuery.set(''); // Clear the input field
    }

    function handleExcludeKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter') {
            e.preventDefault();
            addExcludedTag(get(excludeTagQuery));
        }
    }

    function removeExcludedTag(tagToRemove: string) {
        excludedTags.update(current => current.filter(t => t !== tagToRemove));
    }
    
    function selectExcludeSuggestion(value: string) {
        addExcludedTag(value);
        excludeTagInput.blur();
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
            .map(novel => `${novel.title}, ${novel.id}, ${novel.source || 'N/A'}`) // Include source in export
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
        const novelId = target.dataset.novelId; // Get the novel ID from a data attribute
        const novelSource = target.dataset.novelSource; // Get the novel source from a data attribute

        // Find the novel in allNovels to access its original URLs
        const novel = get(allNovels).find(n => String(n.id) === novelId && n.source === novelSource);

        if (!novel) {
            console.error(`Novel with ID ${novelId} and source ${novelSource} not found for cover error handling.`);
            if (target.parentElement) {
                target.parentElement.classList.add('no-cover');
            }
            target.style.display = 'none';
            return;
        }

        // If large_cover_url failed, try cover_url
        if (target.src === novel.large_cover_url && novel.cover_url) {
            target.src = novel.cover_url;
        } else {
            // If both failed or only cover_url was available and failed
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
        <p class="subtitle">Search and filter through the Novelpia, Kakao, and SFACG novel libraries.</p>
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
            </fieldset>

            <fieldset class="tag-fieldset">
                 <legend>Tag Filters</legend>
                <div class="tag-inputs-grid">
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

                    <div class="autocomplete-wrapper">
                        <input
                            type="search"
                            placeholder="Exclude this tag..."
                            bind:value={$excludeTagQuery}
                            bind:this={excludeTagInput}
                            on:keydown={handleExcludeKeydown}
                            on:focus={handleFocus}
                            on:blur={() => handleBlurWithTimeout(excludeTagInput)}
                        />
                         {#if $excludeTagSuggestions.length > 0 && excludeTagInput === document.activeElement}
                            <ul class="suggestions-list">
                                {#each $excludeTagSuggestions as suggestion}
                                    <li>
                                        <button class="suggestion-button" on:click={() => selectExcludeSuggestion(suggestion)}>
                                            {suggestion}
                                        </button>
                                    </li>
                                {/each}
                            </ul>
                        {/if}
                    </div>
                 </div>

                {#if $excludedTags.length > 0}
                    <div class="excluded-tags-display">
                        <span>Excluding:</span>
                        {#each $excludedTags as tag}
                            <span class="tag-badge excluded">
                                {tag}
                                <button class="remove-tag-btn" on:click={() => removeExcludedTag(tag)} title="Remove tag">&times;</button>
                            </span>
                        {/each}
                    </div>
                {/if}
                 <p class="fieldset-subtitle">Include at least ONE of these tags</p>
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
                <button class="secondary" on:click={clearTags} disabled={!$mustHaveTag && $selectedTags.length === 0 && $excludedTags.length === 0}>Clear Tags</button>
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
                <div>
                    <label for="source-filter">Source</label>
                    <select id="source-filter" bind:value={$sourceFilter}>
                        <option value="">All Sources</option>
                        <option value="Novelpia">Novelpia</option>
                        <option value="kakao">Kakao</option>
                        <option value="sfacg">SFACG</option>
                    </select>
                </div>
            </fieldset>
        </div>
    {/if}
    </main>

