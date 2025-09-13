import { onMount } from 'svelte';
import { writable, derived, get, type Writable, type Readable } from 'svelte/store';
import { base } from '$app/paths';

// Defines the structure for a single novel object
export interface Novel {
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

// Svelte stores to manage the application's state
export const allNovels = writable<Novel[]>([]);
export const error = writable<string | null>(null);
export const isLoading = writable<boolean>(true);
export const query = writable('');
export const authorQuery = writable('');
export const mustHaveTagQuery = writable('');
export const mustHaveTags = writable<string[]>([]);
export const selectedTags = writable<string[]>([]);
export const excludedTags = writable<string[]>([]);
export const excludeTagQuery = writable('');
export const showAdult = writable<'any' | 'true' | 'false'>('any');
export const status = writable<'' | '완결' | '연재중'>('');
export const minChapters = writable(0);
export const maxChapters = writable(9999);
export const minLikes = writable(0);
export const maxLikes = writable(999999);
export const withCoverOnly = writable(false);
export const sortBy = writable('likes');
export const sortDir = writable('desc');
export const perPage = writable(20);
export const currentPage = writable(1);
export const showFilters = writable(true);
export const sourceFilter = writable<'' | 'Novelpia' | 'kakao' | 'sfacg'>('');

// Variables to bind to HTML input elements
export let jumpToPage: number | null = null;
export let queryInput: HTMLInputElement;
export let authorQueryInput: HTMLInputElement;
export let mustHaveTagInput: HTMLInputElement;
export let excludeTagInput: HTMLInputElement;
let blurTimeout: number;

// Derived store that filters novels based on the selected source
export const sourceFilteredNovels = derived([allNovels, sourceFilter], ([$allNovels, $sourceFilter]) => {
	if ($sourceFilter === '') {
		return $allNovels;
	}
	return $allNovels.filter((novel) => novel.source === $sourceFilter);
});

// Derived stores for unique authors, titles, and tags
export const allUniqueAuthors = derived(allNovels, ($allNovels) => [...new Set($allNovels.map((n) => n.author))].sort());
export const allUniqueTitles = derived(allNovels, ($allNovels) => [...new Set($allNovels.map((n) => n.title))].sort());
export const allUniqueTags = derived(sourceFilteredNovels, ($sourceFilteredNovels) => [...new Set($sourceFilteredNovels.flatMap((n) => n.tags || []))].sort());

// Derived store to find the most popular tags
export const topTags = derived(sourceFilteredNovels, ($sourceFilteredNovels) => {
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

// A factory function to create suggestion stores for autocomplete inputs
export const createSuggestionStore = (inputStore: Writable<string>, dataStore: Readable<string[]>) => {
	return derived([inputStore, dataStore], ([$input, $data]) => {
		const trimmedInput = $input.trim();
		if (!trimmedInput || trimmedInput.length < 2) return [];
		const lowercasedInput = trimmedInput.toLowerCase();
		const filtered = $data.filter((item) => item.toLowerCase().includes(lowercasedInput));

		filtered.sort((a, b) => {
			const aLower = a.toLowerCase();
			const bLower = b.toLowerCase();
			const aStarts = aLower.startsWith(lowercasedInput);
			const bStarts = bLower.startsWith(lowercasedInput);
			if (aStarts && !bStarts) return -1;
			if (!aStarts && bStarts) return 1;
			return aLower.localeCompare(bLower);
		});
		return filtered.slice(0, 7);
	});
};

// Create specific suggestion stores
export const titleSuggestions = createSuggestionStore(query, allUniqueTitles);
export const authorSuggestions = createSuggestionStore(authorQuery, allUniqueAuthors);
export const tagSuggestions = createSuggestionStore(mustHaveTagQuery, allUniqueTags);
export const excludeTagSuggestions = createSuggestionStore(excludeTagQuery, allUniqueTags);

// The main derived store that filters and sorts novels based on all user inputs
export const filteredNovels = derived(
	[ allNovels, query, authorQuery, mustHaveTags, selectedTags, excludedTags, showAdult, status, minChapters, maxChapters, minLikes, maxLikes, withCoverOnly, sortBy, sortDir, sourceFilter ],
	([ $allNovels, $query, $authorQuery, $mustHaveTags, $selectedTags, $excludedTags, $showAdult, $status, $minChapters, $maxChapters, $minLikes, $maxLikes, $withCoverOnly, $sortBy, $sortDir, $sourceFilter ]) => {
		const q = $query.toLowerCase().trim();
		const filtered = $allNovels.filter((novel) => {
			const novelTagsLower = novel.tags?.map((t) => t.toLowerCase()) ?? [];
			const matchesQuery = q === '' || novel.title?.toLowerCase().includes(q) || String(novel.id) === q;
			const matchesAuthor = $authorQuery === '' || novel.author?.toLowerCase().includes($authorQuery.toLowerCase());
			const matchesMustHaveTags = $mustHaveTags.length === 0 || $mustHaveTags.every((requiredTag) => novelTagsLower.includes(requiredTag));
			const matchesOptionalTags = $selectedTags.length === 0 || $selectedTags.some((selectedTag) => novelTagsLower.includes(selectedTag.toLowerCase()));
			const matchesExcludedTags = $excludedTags.length === 0 || !$excludedTags.some((excludedTag) => novelTagsLower.includes(excludedTag));
			const matchesAdult = $showAdult === 'any' || novel.is_adult?.toString() === $showAdult;
			const matchesStatus = $status === '' || novel.publication_status === $status;
			const matchesChapters = (novel.chapter_count ?? 0) >= $minChapters && (novel.chapter_count ?? 0) <= $maxChapters;
			const matchesLikes = (novel.like_count ?? 0) >= $minLikes && (novel.like_count ?? 0) <= $maxLikes;
			const hasCover = !$withCoverOnly || (novel.cover_url && novel.cover_url.trim() !== '');
			const matchesSource = $sourceFilter === '' || novel.source === $sourceFilter;

			return (matchesQuery && matchesAuthor && matchesMustHaveTags && matchesOptionalTags && matchesExcludedTags && matchesAdult && matchesStatus && matchesChapters && matchesLikes && hasCover && matchesSource);
		});

		filtered.sort((a, b) => {
			let result = 0;
			switch ($sortBy) {
				case 'likes': result = (b.like_count ?? 0) - (a.like_count ?? 0); break;
				case 'chapters': result = (b.chapter_count ?? 0) - (a.chapter_count ?? 0); break;
				case 'views': result = (b.views ?? 0) - (a.views ?? 0); break;
				case 'title': result = a.title.localeCompare(b.title); break;
			}
			return $sortDir === 'asc' ? -result : result;
		});

		return filtered;
	}
);

// Derived stores for pagination
export const pagedNovels = derived( [filteredNovels, currentPage, perPage], ([$filteredNovels, $currentPage, $perPage]) => {
		const start = ($currentPage - 1) * $perPage;
		const end = start + $perPage;
		return $filteredNovels.slice(start, end);
	}
);
export const totalPages = derived([filteredNovels, perPage], ([$filteredNovels, $perPage]) => Math.ceil($filteredNovels.length / $perPage) || 1);

// Reset to the first page whenever filters change
filteredNovels.subscribe(() => {
	currentPage.set(1);
});

// Lifecycle function to fetch data when the component mounts
onMount(async () => {
	try {
		const novelpiaRes = await fetch(`${base}/novelpia_metadata.jsonl`);
		if (!novelpiaRes.ok) throw new Error(`HTTP error! status: ${novelpiaRes.status}`);

		const novelpiaText = await novelpiaRes.text();
		const novelpiaNovels = novelpiaText
			.split('\n')
			.filter((line) => line.trim() !== '')
			.map((line) => {
				try {
					const novel = JSON.parse(line);
					if (novel.tags && Array.isArray(novel.tags)) {
						novel.tags = novel.tags.map( (tag: any) => String(tag).startsWith('#') ? String(tag).substring(1) : String(tag) );
					} else {
						novel.tags = [];
					}
					novel.source = novel.source || 'Novelpia';
					novel.views = novel.view_count ?? 0;
					novel.likes = novel.like_count ?? 0;
					novel.status = novel.is_complete == 1 ? '완결' : '연재중';
					return novel;
				} catch (parseError) {
					console.error('Failed to parse a line of JSONL:', parseError, 'Line:', line);
					return null;
				}
			})
			.filter(Boolean);

		console.log('Successfully loaded and parsed Novelpia data:', novelpiaNovels);

		const kakaoRes = await fetch(`${base}/kakao_novels.jsonl`);
		if (!kakaoRes.ok) throw new Error(`HTTP error ${kakaoRes.status} for Kakao data`);
		const kakaoText = await kakaoRes.text();
		const kakaoNovels: Novel[] = kakaoText
			.split('\n').filter(Boolean).map((line) => JSON.parse(line));

		const sfacgRes = await fetch(`${base}/sfacg_novels.jsonl`);
		if (!sfacgRes.ok) throw new Error(`HTTP error ${sfacgRes.status} for SFACG data`);
		const sfacgText = await sfacgRes.text();
		const sfacgNovels: Novel[] = sfacgText
			.split('\n').filter(Boolean).map((line) => JSON.parse(line));

		allNovels.set([...novelpiaNovels, ...kakaoNovels, ...sfacgNovels]);
	} catch (err: any) {
		error.set(`Failed to load metadata: ${err.message}.`);
		console.error('Failed to load metadata:', err);
	} finally {
		isLoading.set(false);
	}
});

// Functions to manage tags
export function clearTags() {
	selectedTags.set([]);
	mustHaveTags.set([]);
	mustHaveTagQuery.set('');
	excludedTags.set([]);
	excludeTagQuery.set('');
}

export function addMustHaveTag(tag: string) {
	const cleanTag = tag.trim().toLowerCase();
	if (cleanTag && !get(mustHaveTags).includes(cleanTag)) {
		mustHaveTags.update((current) => [...current, cleanTag]);
	}
	mustHaveTagQuery.set('');
}

export function handleMustHaveKeydown(e: KeyboardEvent) {
	if (e.key === 'Enter') {
		e.preventDefault();
		addMustHaveTag(get(mustHaveTagQuery));
	}
}

export function removeMustHaveTag(tagToRemove: string) {
	mustHaveTags.update((current) => current.filter((t) => t !== tagToRemove));
}

export function selectMustHaveSuggestion(value: string) {
	addMustHaveTag(value);
	mustHaveTagInput.blur();
}

export function addExcludedTag(tag: string) {
	const cleanTag = tag.trim().toLowerCase();
	if (cleanTag && !get(excludedTags).includes(cleanTag)) {
		excludedTags.update((current) => [...current, cleanTag]);
	}
	excludeTagQuery.set('');
}

export function handleExcludeKeydown(e: KeyboardEvent) {
	if (e.key === 'Enter') {
		e.preventDefault();
		addExcludedTag(get(excludeTagQuery));
	}
}

export function removeExcludedTag(tagToRemove: string) {
	excludedTags.update((current) => current.filter((t) => t !== tagToRemove));
}

export function selectExcludeSuggestion(value: string) {
	addExcludedTag(value);
	excludeTagInput.blur();
}

// Pagination and utility functions
export function goToPage() {
	if (jumpToPage && jumpToPage > 0 && jumpToPage <= get(totalPages)) {
		currentPage.set(jumpToPage);
	}
	const inputElem = document.querySelector('.pagination-input input') as HTMLInputElement;
	if (inputElem) inputElem.value = '';
	jumpToPage = null;
}

export const customMessage = writable<string | null>(null);

export function showCustomMessage(message: string) {
	customMessage.set(message);
	setTimeout(() => customMessage.set(null), 3000);
}

export function exportFilteredNovels() {
	const novelsToExport = get(filteredNovels);
	if (novelsToExport.length === 0) {
		showCustomMessage('No novels found matching your criteria to export.');
		return;
	}
	const content = novelsToExport.map((novel) => `${novel.title}, ${novel.id}, ${novel.source || 'N/A'}`).join('\n');
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

export function handleCoverError(e: Event) {
	const target = e.target as HTMLImageElement;
	const novelId = target.dataset.novelId;
	const novelSource = target.dataset.novelSource;
	const novel = get(allNovels).find((n) => String(n.id) === novelId && n.source === novelSource);

	if (!novel) {
		if (target.parentElement) target.parentElement.classList.add('no-cover');
		target.style.display = 'none';
		return;
	}

	if (target.src === novel.large_cover_url && novel.cover_url) {
		target.src = novel.cover_url;
	} else {
		if (target.parentElement) target.parentElement.classList.add('no-cover');
		target.style.display = 'none';
	}
}

// Functions for autocomplete suggestions
export function selectSuggestion(store: Writable<string>, value: string, inputRef: HTMLInputElement) {
	store.set(value);
	inputRef.blur();
}

export function handleBlurWithTimeout(inputRef: HTMLInputElement) {
	clearTimeout(blurTimeout);
	blurTimeout = setTimeout(() => {
		if (document.activeElement !== inputRef) {
			// future logic
		}
	}, 150);
}

export function handleFocus() {
	clearTimeout(blurTimeout);
}