"""Translate the six validators in this particular console engine to browser JS."""
import re
from pathlib import Path
root = Path(__file__).resolve().parents[1]
source = (root / 'original/chess_arsenal.cpp').read_text()
parts = re.findall(r'bool chess :: (\w+) :: Validate_move\([^\n]*\)\s*\{(.*?)\n\};', source, re.S)
assert len(parts) == 6
result = ['// Generated from original/chess_arsenal.cpp by scripts/build_rules.py.', 'export const validators = {']
for name, body in parts:
    body = re.sub(r'//[^\n]*', '', body)
    body = re.sub(r'\b(char|bool|int|Piece\*)\s+', 'let ', body)
    body = body.replace('this->get_player()', 'side(Board[source_rank*8+source_file])').replace('destined_position->get_player()', 'side(destined_position)')
    body = re.sub(r'Board\[([^\]]+)\]\[([^\]]+)\]', r'Board[(\1)*8+(\2)]', body)
    body = body.replace('nullptr', '0').replace('abs(', 'Math.abs(')
    key = 'N' if name == 'Knight' else name[0]
    result.append(f'{key}(Board,source_rank,source_file,destined_rank,destined_file) {{'+body+'},')
result.extend(['}',"export const side = p => p===0 ? null : p===p.toUpperCase() ? 'W' : 'B';"])
(root/'dist/rules.mjs').write_text('\n'.join(result))
