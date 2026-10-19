# POPs Atlas · Global Emissions Dashboard

Single-page responsive dashboard for exploring **persistent organic pollutant (POP) emissions** across countries, years, inventories and emission sectors.

**Status:** A complete interactive dashboard with published EDGAR v8.1 and Breivik PCB catalogs and three Breivik scenarios. Illustrative demo values remain clearly separated from published data and must never be used in analysis or publications.

## Features
- Dark/light mode, saved in browser local storage
- Responsive desktop, tablet and mobile layouts
- Pollutant selector
- **Inventory selector:** EDGAR and Breivik published catalogs
- **Breivik scenario selector:** Baseline, Default and Worst case (1930–2100)
- **Emission source multi-select:** eight official EDGAR-style sector categories
- One **Map inventory** at a time; comparison panel shows other selected inventories separately. Independent estimates are never summed.
- Interactive country choropleth, tooltip, zoom, click for country details, map/table toggle
- Full-width year slider **directly below the map**, with playback
- Three highest and three lowest reporting countries
- Sector-specific emissions trends, global KPIs, sector donut, regional chart, inventory comparisons
- Filtered CSV export for the current view
- Conservative India-region masking when an authoritative boundary is unavailable

## Run

From repository root:

```bash
python -m http.server 8000
```

Visit http://localhost:8000. The app requires network access to load D3 from jsDelivr and a public world GeoJSON basemap.

No build tools or API keys are required. It also works when hosted as static HTML on Vercel, Netlify or GitHub Pages (subject to repository hosting permissions).

## Demo mode and data integrity

The app **starts in illustrative DEMO mode** so the complete design can be reviewed without emissions datasets. The generated values are fictitious and are not attributed to EDGAR, Breivik or any other published study. A conspicuous banner identifies this state.

Click **Exit demo** to display an empty authentic-data workspace. Published catalogs are loaded automatically when their manifest is available; the light/dark theme is persisted locally.

### Official emission sector taxonomy

The default eight categories are based on [EDGAR POPs v8.1 sector definitions](https://edgar.jrc.ec.europa.eu/dataset_pop81):

1. Power Industry
2. Industrial Combustion
3. Buildings
4. Transport
5. Agriculture
6. Fuel Exploitation
7. Processes
8. Waste

EDGAR **Agriculture** includes multiple agricultural activities and is not synonymous solely with agricultural burning. Taxonomies can vary by inventory; do not relabel Breivik categories as though they were identical without a documented crosswalk.

### India international boundary

A global country basemap is **not** an official representation of India's international boundary. To avoid displaying an uncertified political border as authoritative, the dashboard masks an approximate rectangle from **67–98°E, 6–38°N**. The mask is a visual safeguard, **not** a boundary; it also suppresses neighboring countries intersecting that region.

To restore India's outline, legally obtain the approved official vector data from [Survey of India](https://surveyofindia.gov.in/pages/outline-maps-of-india), convert it to polygon GeoJSON if needed, and add it as `data/boundaries/india.geojson`. The app checks basic polygon extent but **cannot verify the file's authenticity**. Confirm licensing and the correct official version before releasing a production map. For production, use an authoritative harmonized regional set so neighboring-country borders are topologically consistent. Do not claim that the third-party global GeoJSON has Survey of India certification.

## Production limitations and roadmap
- Published EDGAR and Breivik catalogs are bundled with source checksums; refresh them only through the documented preprocessing workflow.
- Basemap and D3 depend on external network/CDN.
- Process gridded EDGAR NetCDF to mass-conserving country totals offline, with boundary/version documentation.
- Cross-inventory comparisons require matching pollutant, units, period, geography and sector definitions.
- Protect provenance with checksums, licenses and DOI/release notes when preparing research-grade data.
- Add automated browser/keyboard test coverage and local assets for offline usage before production deployment.

## References
- [EDGAR v8.1 POPs inventory / sectors](https://edgar.jrc.ec.europa.eu/dataset_pop81)
- [Breivik global PCB scenarios](https://projects.nilu.no/globalpcb/)
- [Survey of India official map resources](https://surveyofindia.gov.in/pages/outline-maps-of-india)


## Automatic EDGAR synchronization

The GitHub Actions workflow `.github/workflows/sync-edgar.yml` runs every Monday at 05:13 UTC, or can be launched via **Actions → Sync EDGAR POPs inventories → Run workflow**. It reads the official annual EDGAR v8.1 country-sector ZIP download links from the [EDGAR POPs dataset page](https://edgar.jrc.ec.europa.eu/dataset_pop81), checks archive SHA-256 digests, validates annual IPCC 2006 sector records, converts kton/year to tonnes/year, and writes compact pollutant-specific JSON files plus a manifest to `data/edgar/`. A commit is created only if processed data change. On dashboard load, a valid manifest loads the selected EDGAR catalog; otherwise the clearly labeled illustrative demo remains.

**Important bootstrap status:** The synchronizer code is committed but the scheduled workflow has **not yet been confirmed to complete against real EDGAR Excel files**. Its initial execution may need workbook-layout adjustments; it fails closed rather than silently publishing partial or fabricated totals. No EDGAR emission observations are claimed available until the first successful workflow commit creates `data/edgar/manifest.json`. A GitHub Actions run requires repository Actions permissions and push rights for `GITHUB_TOKEN`.

The supported mass-based pollutants are PCB (aggregate unintentional, **not PCB-28**), HCB, and four PAHs (BaP, BbF, BkF, IcdP). EDGAR PCDD/F is deliberately excluded because the official dataset reports it in toxic-equivalent (TEQ) units, not tonnes of pollutant. This requires a separate unit mode before enabling it.

### Running synchronization locally

```bash
pip install -r scripts/edgar-dependencies.txt
python scripts/sync_edgar.py
```

This workflow downloads official files **only during scheduled updates**, not every time a visitor opens the map. The dashboard fetches lightweight static JSON directly from its hosting origin.

### Credit

Source: **EDGAR v8.1 Global Unintentional POPs Emissions**, European Commission Joint Research Centre. [Official dataset](https://edgar.jrc.ec.europa.eu/dataset_pop81) · [Dataset DOI](https://doi.org/10.2905/950c9f4b-19af-4071-a9e2-f1be34f3c438). Acknowledge EDGAR, the associated Muntean et al. (2026, in preparation) work and the dataset DOI, as specified by EDGAR. Check underlying rights and redistribution terms before publication.

## User-supplied India outline (October 2026)

The dashboard attempts to load `data/boundaries/india.geojson` automatically on page load. The file must be committed under that path to be available to visitors. The original user-supplied `Shape Files India.zip` contains one valid EPSG:4326 MultiPolygon (755 polygon parts; bounds 68.186249°E, 6.754256°N to 97.415161°E, 37.078331°N). This local clone does not include a ZIP-to-GeoJSON conversion script; use an approved GIS workflow to create the file and preserve its provenance record.

After conversion, add `data/boundaries/india.geojson` and `data/boundaries/india.provenance.json`. If the GeoJSON is absent, the protective mask remains. The ZIP does not establish official Survey of India provenance or redistribution rights, so verify both before publicly hosting the outline.
