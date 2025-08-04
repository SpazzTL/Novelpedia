import json

def add_source_to_novels(input_filename, output_filename, source_name):
  """
  Adds a 'source' field to each novel in a JSON file and saves the result to a new file.

  Args:
    input_filename (str): The path to the input JSON file.
    output_filename (str): The path where the new JSON file will be saved.
    source_name (str): The value to be assigned to the 'source' field.
  """
  try:
    with open(input_filename, 'r', encoding='utf-8') as f:
      novels = json.load(f)

    for novel in novels:
      novel['source'] = source_name

    with open(output_filename, 'w', encoding='utf-8') as f:
      json.dump(novels, f, ensure_ascii=False, indent=2)

    print(f"Successfully added 'source' field to {len(novels)} novels.")
    print(f"The updated data has been saved to '{output_filename}'.")

  except FileNotFoundError:
    print(f"Error: The file '{input_filename}' was not found.")
  except json.JSONDecodeError:
    print(f"Error: The file '{input_filename}' is not a valid JSON file.")
  except Exception as e:
    print(f"An unexpected error occurred: {e}")

# Specify the filenames and the source value
input_file = 'novelpia_metadata.json'
output_file = 'novelpia_metadata_with_source.json'
source_value = 'Novelpia'

# Run the function
add_source_to_novels(input_file, output_file, source_value)