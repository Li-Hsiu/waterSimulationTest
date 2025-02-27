import os
import json

def find_gltf_files(folder_path, substring):
    gltf_files = []
    for root, dirs, files in os.walk(folder_path):
        if substring in root:
            for file in files:
                if file.endswith('.gltf'):
                    gltf_files.append(os.path.join(root, file).replace('\\', '/'))
    return gltf_files

def write_to_json(file_list, output_file):
    with open(output_file, 'w') as json_file:
        json.dump(file_list, json_file, indent=4)

folder_path = './models'  
output_file = 'modelStrings.json'
specific_string = 'TERRAIN(TB)'

gltf_file_list = find_gltf_files(folder_path, specific_string)
write_to_json(gltf_file_list, output_file)
