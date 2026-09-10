# BME Caliper Borehole Data Processor

A specialized, client-side web application for processing borehole Caliper tracking `.LAS` files into standardized BME Excel calipering templates (`.xlsx`), with zero server backend or external CDN dependencies.

## Key Features

- **100% Client-Side Processing**: No servers, no APIs, no tracking, complete data privacy for mine operations.
- **Offline Capable**: Registered Service Worker caches all assets for field work without internet connectivity.
- **Python-Engine Parity**: Accurately implements the borehole data processing rules:
  - Header stripping (20 lines)
  - Bottom-of-hole negative reading cleanup (deletes row and subsequent 50 records)
  - Depth filtering below final stemming threshold
  - Ascending depth sorting
  - Automatic formula injection (`Radius`, `-Radius`, `Planned Rad`, `-Planned Rad`, `Planned Diam`, `Diff`)
  - Information sheet synchronization (`Client`, `Mine`, `Block ID`, `Planned Diameter`, `Stemming`, `Density`, `Operator`, `Date`)
  - Table sheet updates with hole names, deleted unused rows, and `MIN`, `AVERAGE`, `MAX` formula computation
  - Unused sheet deletion while preserving core sheets (`Graphs`, `Table`, `Information`)
- **Interactive Borehole Profile Visualizer**: Inspect each borehole's 2D caliper trace directly in the browser before exporting.
- **No External CDNs**: All scripts (`exceljs.min.js`, `jszip.min.js`, `marked.min.js`, `script.js`, `style.css`) are stored locally to prevent CORS or blocked network requests on GitHub Pages.

## How to Host on GitHub Pages (No Build Step Required)

1. **Create a GitHub Repository**:
   - Go to [GitHub](https://github.com) and click **New Repository**.
   - Name it (e.g. `bme-caliper-processor`).
2. **Upload Repository Files**:
   - Upload all files from this directory directly into the repository root:
     - `index.html`
     - `style.css`
     - `script.js`
     - `service-worker.js`
     - `libs/`
     - `templates/`
     - `sample_data/`
3. **Enable GitHub Pages**:
   - In your repository, go to **Settings** -> **Pages**.
   - Under **Build and deployment** -> **Source**, select **Deploy from a branch**.
   - Branch: `main` (or `master`), folder: `/ (root)`.
   - Click **Save**.
4. **Done!**
   - GitHub Pages will provide a live URL (e.g. `https://<your-username>.github.io/bme-caliper-processor/`).
   - The application will run immediately with no build steps or server setup.

## Offline Field Usage

When opening the app in Google Chrome, Microsoft Edge, or Firefox, the Service Worker automatically caches all assets on first load. You can bookmark the URL and use it offline at blast sites or mine benches without cellular connectivity.
