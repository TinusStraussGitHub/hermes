#!/usr/bin/env python3
"""Run Calipering Reader.py non-interactively with env settings."""
import os, sys, importlib.util
sys.path.insert(0, '.')

# Load user's module
spec = importlib.util.spec_from_file_location("caliper_reader", "/opt/data/cache/documents/doc_04f0bde6c7ec_Calipering Reader.py")
caliper = importlib.util.module_from_spec(spec)
if spec and spec.loader:
    spec.loader.exec_module(caliper)
else:
    raise ImportError("Could not load Calipering Reader.py")

from openpyxl import load_workbook

folder = sys.argv[1]
template_path = sys.argv[2]
output_path = sys.argv[3]

wb = load_workbook(template_path)
info = wb['Information']
info['C1'] = os.environ.get('CALIPER_CLIENT', 'BME Client')
info['C2'] = os.environ.get('CALIPER_MINE', 'Delmas')
info['C3'] = os.environ.get('CALIPER_BLOCK', 'Block-A')
info['C4'] = float(os.environ.get('CALIPER_PLANNED_D', '165'))
info['C5'] = float(os.environ.get('CALIPER_FINAL_STEM', '1'))
info['C6'] = float(os.environ.get('CALIPER_DENSITY', '1.2'))
info['C7'] = os.environ.get('CALIPER_OPERATOR', '')
info['C8'] = os.environ.get('CALIPER_DATE', '')

processed, used = caliper.process_las_files(folder, wb)
caliper.delete_unused_sheets(wb, used)
caliper.update_table_sheet(wb, used)
wb.save(output_path)
print(f"Processed {processed} -> {output_path}")
