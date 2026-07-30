#!/usr/bin/env python3
"""
Flask server for serving the Insights Hub and handling the conference tag generation API.
"""
import os
import subprocess
import tempfile
from flask import Flask, send_from_directory, request, jsonify, send_file

app = Flask(__name__, static_folder='/opt/data/home/hermes')

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_static(path):
    """Serve static files from the Insights Hub directory."""
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

@app.route('/api/generate-conference-tags', methods=['POST'])
def generate_conference_tags():
    """Handle the conference tag generation request."""
    if 'csvFile' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['csvFile']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    if file:
        # Save the file to a temporary location
        with tempfile.NamedTemporaryFile(delete=False, suffix='.csv') as temp_csv:
            file.save(temp_csv.name)
            csv_path = temp_csv.name

        # Get orientation from form data
        orientation = request.form.get('orientation', 'landscape')

        # Determine which script to use
        if orientation == 'portrait':
            script_path = '/opt/data/conference_guide/generate_tags.py'
        else:
            script_path = '/opt/data/conference_guide/generate_tags_landscape.py'

        # Create a temporary output file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_pdf:
            pdf_path = temp_pdf.name

        # Run the script
        try:
            result = subprocess.run([
                'python3', script_path, csv_path, pdf_path
            ], check=True, capture_output=True, text=True)
        except subprocess.CalledProcessError as e:
            # Clean up temp files on error
            try:
                os.unlink(csv_path)
            except:
                pass
            try:
                os.unlink(pdf_path)
            except:
                pass
            return jsonify({'error': f'Generation failed: {e.stderr}'}), 500

        # Send the PDF file as a response and clean up after sending
        def generate_response():
            try:
                with open(pdf_path, 'rb') as f:
                    data = f.read()
                yield data
            finally:
                # Clean up temp files
                try:
                    os.unlink(csv_path)
                except:
                    pass
                try:
                    os.unlink(pdf_path)
                except:
                    pass

        response = app.response_class(
            generate_response(),
            mimetype='application/pdf',
            headers={'Content-Disposition': f'attachment; filename=conference_tags_{orientation}.pdf'}
        )
        return response

if __name__ == '__main__':
    # Run on port 80 to replace the existing server
    app.run(host='0.0.0.0', port=80, debug=True)