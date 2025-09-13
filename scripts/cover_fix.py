import json

def process_jsonl(file_path):
    """
    Reads a JSONL file, adds a base URL to the 'cover_url' field of each JSON object,
    and overwrites the file with the modified data.
    """
    try:
        # Step 1: Read all content from the file into memory
        with open(file_path, 'r', encoding='utf-8') as infile:
            lines = infile.readlines()

        modified_data = []
        for line in lines:
            item = json.loads(line)
            
            # Check if 'cover_url' exists and is not a full URL
            if 'cover_url' in item and item['cover_url'] and not item['cover_url'].startswith('http'):
                item['cover_url'] = "https://novelpia.com" + item['cover_url']
            
            modified_data.append(item)
        
        # Step 2: Overwrite the same file with the modified data
        with open(file_path, 'w', encoding='utf-8') as outfile:
            for item in modified_data:
                outfile.write(json.dumps(item, ensure_ascii=False) + '\n')
                
        print(f"File processing complete. '{file_path}' has been replaced with modified data.")
    
    except FileNotFoundError:
        print(f"Error: The file '{file_path}' was not found.")
    except json.JSONDecodeError:
        print(f"Error: There was an issue decoding JSON from the file '{file_path}'.")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

# Example usage:
# This will safely modify the 'novelpia_metadata.jsonl' file in place.
process_jsonl('novelpia_metadata.jsonl')