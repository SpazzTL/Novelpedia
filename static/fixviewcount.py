import json

def fix_view_counts(input_filename, output_filename):
    correction_threshold = 10000000 

    with open(input_filename, 'r', encoding='utf-8') as infile, \
         open(output_filename, 'w', encoding='utf-8') as outfile:
        for line in infile:
            try:
                data = json.loads(line)
                
                if isinstance(data.get('views'), int) and data['views'] >= correction_threshold:
                    data['views'] = data['views'] // 10
                
                outfile.write(json.dumps(data, ensure_ascii=False) + '\n')
            
            except json.JSONDecodeError:
                print(f"Skipping malformed JSON line: {line.strip()}")
            except Exception as e:
                print(f"An error occurred: {e}")

# IMPORTANT: Ensure this 'input_file' path matches the actual location and name of your JSONL file.
input_file = 'kakao_novels.jsonl' 
output_file = 'corrected_output.jsonl'

fix_view_counts(input_file, output_file)

print(f"View counts fixed. Corrected data saved to '{output_file}'.")
