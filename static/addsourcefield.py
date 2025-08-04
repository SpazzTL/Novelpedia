import json

def add_source_to_novels_jsonl(input_filename, output_filename, source_name):
  """
  Adds a 'source' field to each novel in a JSONL file and saves the result to a new file.

  Args:
    input_filename (str): The path to the input JSONL file.
    output_filename (str): The path where the new JSONL file will be saved.
    source_name (str): The value to be assigned to the 'source' field.
  """
  try:
    with open(input_filename, 'r', encoding='utf-8') as infile, \
         open(output_filename, 'w', encoding='utf-8') as outfile:
      
      lines_processed = 0
      for line in infile:
        if line.strip():  # Skip empty lines
          try:
            novel = json.loads(line)
            novel['source'] = source_name
            json.dump(novel, outfile, ensure_ascii=False)
            outfile.write('\n')
            lines_processed += 1
          except json.JSONDecodeError as e:
            print(f"Error decoding JSON on line: {line.strip()}. Skipping line. Error: {e}")
            
    print(f"Successfully added 'source' field to {lines_processed} novels.")
    print(f"The updated data has been saved to '{output_filename}'.")

  except FileNotFoundError:
    print(f"Error: The file '{input_filename}' was not found.")
  except Exception as e:
    print(f"An unexpected error occurred: {e}")

# Specify the filenames and the source value
input_file = 'novelpia_metadata.jsonl'
output_file = 'novelpia_metadata_with_source.jsonl'
source_value = 'Novelpia'

# Run the function
add_source_to_novels_jsonl(input_file, output_file, source_value)