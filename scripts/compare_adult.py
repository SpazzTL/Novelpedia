import json

# --- Configuration ---
ADULT_FILE_PATH = 'adult_novelpia_metadata.jsonl'
NORMAL_FILE_PATH = 'novelpia_metadata.jsonl'
OUTPUT_FILE_PATH = 'all_novels_final_tagged.jsonl'
UNIQUE_KEY = 'id' # The unique identifier for each novel

def tag_unique_adult_only_novels():
    """
    Merges two JSONL files. A novel is tagged as "is_adult": true ONLY if it
    exists in the adult file but NOT in the normal file. All other novels
    are tagged as "is_adult": false. The output contains all unique novels.
    """
    print("Starting the revised tagging process... 🎯")

    # Step 1: Get all unique IDs from the normal file into a set.
    print(f"Reading normal novel IDs from '{NORMAL_FILE_PATH}'...")
    try:
        with open(NORMAL_FILE_PATH, 'r', encoding='utf-8') as f:
            normal_ids = {json.loads(line).get(UNIQUE_KEY) for line in f if line.strip()}
            normal_ids.discard(None)
        print(f"Found {len(normal_ids)} unique novels in the normal file.")
    except FileNotFoundError:
        print(f"Error: The file '{NORMAL_FILE_PATH}' was not found. Please check the path.")
        return
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON in '{NORMAL_FILE_PATH}': {e}")
        return

    # Step 2: Get all unique IDs from the adult file into a set.
    print(f"Reading adult novel IDs from '{ADULT_FILE_PATH}'...")
    try:
        with open(ADULT_FILE_PATH, 'r', encoding='utf-8') as f:
            all_adult_ids = {json.loads(line).get(UNIQUE_KEY) for line in f if line.strip()}
            all_adult_ids.discard(None)
        print(f"Found {len(all_adult_ids)} unique novels in the adult file.")
    except FileNotFoundError:
        print(f"Error: The file '{ADULT_FILE_PATH}' was not found. Please check the path.")
        return
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON in '{ADULT_FILE_PATH}': {e}")
        return

    # Step 3: Identify the truly adult novels.
    # This is the core of the corrected logic: find IDs in the adult set that are NOT in the normal set.
    truly_adult_ids = all_adult_ids.difference(normal_ids)
    print(f"Identified {len(truly_adult_ids)} novels that are unique to the adult file and will be tagged.")

    # Step 4: Merge all novels into a single dictionary to handle duplicates.
    # We use data from the adult file if a novel appears in both, as it might be more complete.
    combined_novels = {}
    
    # Process the normal file first
    print(f"Merging novels from '{NORMAL_FILE_PATH}'...")
    try:
        with open(NORMAL_FILE_PATH, 'r', encoding='utf-8') as f:
            for line in f:
                if not line.strip(): continue
                try:
                    novel = json.loads(line)
                    if novel_id := novel.get(UNIQUE_KEY):
                        combined_novels[novel_id] = novel
                except json.JSONDecodeError:
                    continue # Skip malformed lines
    except FileNotFoundError:
        pass # This error is already handled above

    # Process the adult file second
    print(f"Merging novels from '{ADULT_FILE_PATH}'...")
    with open(ADULT_FILE_PATH, 'r', encoding='utf-8') as f:
        for line in f:
            if not line.strip(): continue
            try:
                novel = json.loads(line)
                if novel_id := novel.get(UNIQUE_KEY):
                    combined_novels[novel_id] = novel
            except json.JSONDecodeError:
                continue
    
    print(f"Total unique novels after merging: {len(combined_novels)}.")

    # Step 5: Iterate through the merged list, apply the correct tag based on our unique list, and write to file.
    print(f"Tagging novels and writing to '{OUTPUT_FILE_PATH}'...")
    try:
        with open(OUTPUT_FILE_PATH, 'w', encoding='utf-8') as f:
            for novel_id, novel_data in combined_novels.items():
                # Tag as adult ONLY if the ID is in our 'truly_adult_ids' set
                novel_data['is_adult'] = novel_id in truly_adult_ids
                f.write(json.dumps(novel_data, ensure_ascii=False) + '\n')

        print("Process complete! 🎉")
        print(f"Correctly tagged {len(truly_adult_ids)} unique adult novels.")
        print(f"The file '{OUTPUT_FILE_PATH}' now contains all {len(combined_novels)} unique novels with the correct tags.")
    except IOError as e:
        print(f"Error writing to file '{OUTPUT_FILE_PATH}': {e}")

if __name__ == '__main__':
    tag_unique_adult_only_novels()