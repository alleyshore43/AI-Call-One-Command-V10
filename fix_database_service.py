#!/usr/bin/env python3

import re

# Read the file
with open('/workspace/AI-Call-One-Command-V10/frontend/src/services/database.ts', 'r') as f:
    content = f.read()

# Remove the isDemoMode method
content = re.sub(r'  // Check if we\'re in demo mode\s*\n  static isDemoMode\(\): boolean \{\s*\n.*?\n  \}\s*\n', '', content, flags=re.DOTALL)

# Remove all demo mode conditional blocks
# Pattern: if (this.isDemoMode()) { ... }
def remove_demo_blocks(text):
    lines = text.split('\n')
    result_lines = []
    i = 0
    
    while i < len(lines):
        line = lines[i]
        
        # Check if this line starts a demo mode block
        if 'if (this.isDemoMode())' in line:
            # Find the matching closing brace
            brace_count = 0
            j = i
            
            # Count opening braces in the if line
            brace_count += line.count('{') - line.count('}')
            j += 1
            
            # Skip until we find the matching closing brace
            while j < len(lines) and brace_count > 0:
                brace_count += lines[j].count('{') - lines[j].count('}')
                j += 1
            
            # Skip the demo block entirely
            i = j
        else:
            result_lines.append(line)
            i += 1
    
    return '\n'.join(result_lines)

content = remove_demo_blocks(content)

# Remove any remaining demo-related methods
content = re.sub(r'  static getDemoProfile\(.*?\n  \}\s*\n', '', content, flags=re.DOTALL)
content = re.sub(r'  static getDemoCallLogs\(.*?\n  \}\s*\n', '', content, flags=re.DOTALL)
content = re.sub(r'  static getDemoCampaigns\(.*?\n  \}\s*\n', '', content, flags=re.DOTALL)
content = re.sub(r'  static getDemoAgents\(.*?\n  \}\s*\n', '', content, flags=re.DOTALL)

# Clean up any double newlines
content = re.sub(r'\n\n\n+', '\n\n', content)

# Write the cleaned file
with open('/workspace/AI-Call-One-Command-V10/frontend/src/services/database.ts', 'w') as f:
    f.write(content)

print("Database service cleaned of demo mode code")