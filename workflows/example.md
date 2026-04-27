# Workflow: [Name]

## Objective
What this workflow accomplishes in one sentence.

## Inputs
- `input_1`: Description and expected format
- `input_2`: Description and expected format

## Steps

1. **Step name** — What to do and why
   - Tool: `tools/script_name.py`
   - Command: `python tools/script_name.py --arg value`
   - Expected output: What success looks like

2. **Step name** — What to do and why
   - Tool: `tools/another_script.py`
   - Expected output: What success looks like

## Outputs
- Where the final deliverable goes (e.g., Google Sheet URL, local file path)

## Error Handling
- **Rate limit**: Wait X seconds, retry with smaller batch
- **Auth failure**: Re-run OAuth flow with `tools/auth.py`
- **Missing data**: Log to `.tmp/errors.csv`, continue with remaining records

## Notes
- Any quirks, timing constraints, or API gotchas discovered during use
