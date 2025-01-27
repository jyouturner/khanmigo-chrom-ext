#!/bin/bash

# Default values
project_root="."
output_file="project_context.txt"

# Parse command line arguments
while getopts "p:o:" opt; do
    case $opt in
        p) project_root="$OPTARG";;
        o) output_file="$OPTARG";;
        \?) echo "Invalid option -$OPTARG" >&2; exit 1;;
    esac
done

# Validate project root exists
if [ ! -d "$project_root" ]; then
    echo "Error: Project root directory '$project_root' does not exist" >&2
    exit 1
fi

# Clear or create the output file
> "$output_file"

# Create a simple directory structure using find
echo "Project Structure:" >> "$output_file"
echo "==================" >> "$output_file"
find "$project_root" -type d \
    ! -path "*/\.*" \
    ! -path "*/venv*" \
    ! -path "*/__pycache__*" \
    ! -path "*/build*" \
    ! -path "*/dist*" \
    ! -path "*/*.egg-info*" \
    ! -path "*/*node_module*" \
    -print | sort | sed -e "s/[^-][^\/]*\// |  /g" -e "s/|\([^ ]\)/|-\1/" >> "$output_file"
echo -e "\n\n" >> "$output_file"

# Function to add a file to the output with headers
add_file() {
    local file="$1"
    if [ -f "$file" ]; then
        echo "File: $file" >> "$output_file"
        echo "===================" >> "$output_file"
        echo -e "\n" >> "$output_file"
        cat "$file" >> "$output_file"
        echo -e "\n\n" >> "$output_file"
    fi
}

# First add README if it exists (any case)
find "$project_root" -maxdepth 1 -type f -iname "readme*" | while read -r file; do
    add_file "$file"
done

# Add main Python files in the root directory
if [ -f "$project_root/main.py" ]; then
    add_file "$project_root/main.py"
fi
if [ -f "$project_root/app.py" ]; then
    add_file "$project_root/app.py"
fi

# Add configuration files
for config_file in "package.json" "package-lock.json" "tsconfig.json" "webpack.config.js" ".env.example"; do
    if [ -f "$project_root/$config_file" ]; then
        add_file "$project_root/$config_file"
    fi
done

# Find and add all JavaScript/TypeScript files (excluding test files and build artifacts)
find "$project_root" -type f \( -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" \) \
    ! -path "*/test/*" \
    ! -path "*/tests/*" \
    ! -path "*/__tests__/*" \
    ! -path "*/node_modules/*" \
    ! -path "*/dist/*" \
    ! -path "*/build/*" \
    ! -path "*/coverage/*" \
    -print0 | sort -z | while IFS= read -r -d '' file; do
    add_file "$file"
done

# Print completion message
echo "Project context has been compiled into $output_file"
echo "Total size: $(wc -l < "$output_file") lines"
