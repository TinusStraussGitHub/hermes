#!/usr/bin/env python3
import subprocess, sys, os
folder = sys.argv[1]
template = sys.argv[2]
output = sys.argv[3]
env = os.environ.copy()
env['CALIPER_CLIENT'] = env.get('CALIPER_CLIENT','BME Client')
env['CALIPER_MINE'] = env.get('CALIPER_MINE','Delmas')
env['CALIPER_BLOCK'] = env.get('CALIPER_BLOCK','Block-A')
env['CALIPER_PLANNED_D'] = env.get('CALIPER_PLANNED_D','165')
env['CALIPER_FINAL_STEM'] = env.get('CALIPER_FINAL_STEM','1')
env['CALIPER_DENSITY'] = env.get('CALIPER_DENSITY','1.2')
env['CALIPER_OPERATOR'] = env.get('CALIPER_OPERATOR','')
env['CALIPER_DATE'] = env.get('CALIPER_DATE','')
subprocess.run([
    sys.executable, '/opt/data/home/hermes/caliper_web/run_caliper_simple.py',
    folder, template, output
], env=env, check=True)
