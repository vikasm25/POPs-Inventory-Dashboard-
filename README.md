# POPs Atlas — Persistent Organic Pollutants Inventory Dashboard

Modern, responsive **static web app** for mapping annual country-level POP emissions, examining country histories, and comparing published inventories without combining them.

## Run locally

Open \`index.html\` using a local web server, e.g.:

\`\`\`bash
python -m http.server 8000
\`\`\`

Then visit http://localhost:8000. No build system, API keys or backend required. D3 and country boundaries are fetched over HTTPS, so internet access is needed for the map.

## Input emissions

Click **Import inventory**. Import one or more CSV files with fields:

| country | iso3 | year | pollutant | source | emissions_tonnes_per_year | unit |
|---|---|---:|---|---|---:|---|
| India | IND | 2002 | PCB-28 | EDGAR | (your verified value) | tonnes/year |

**Never use the example above as data.** The template under \`data/\` contains only column headers. Emission values must be nonnegative numeric annual mass totals, not concentrations or grid-cell fluxes. Supported input units: \`tonnes/year\` (default), \`kg/year\`, \`g/year\`; all are converted to tonnes/year. Header aliases include \`country_name\`, \`country_code\`, \`iso_a3\`, \`congener\`, \`inventory\`, \`emissions\` and \`value\`. Missing year/pollutant/source or unsupported units are rejected. Observations with the same country, year, pollutant and source are replaced by later imports to avoid silent doubling.

Each inventory must be pre-aggregated to **country per year per pollutant**. The dashboard does not download or estimate emissions automatically. Importing country-wise tables is supported; gridded NetCDF and GIS raster data require offline processing to country totals using an appropriate country mask and mass-conserving area integration. Do not add EDGAR + Breivik; they are independent estimates.

**Important:** For valid comparisons, confirm the same chemical definition (e.g. PCB-28 vs total PCB), time period, geographic coverage, and mass units for each source. A low global total may just mean incomplete country coverage. Currently these are reported totals of loaded observations, not an assurance of complete global coverage. No data are fabricated.

## Map and India's international boundary

**Authoritative source:** [Survey of India — Outline Maps of India](https://surveyofindia.gov.in/pages/outline-maps-of-india), including its official outline map vector download where available.

The generic world basemap is not authoritative for India. The dashboard therefore deliberately **masks a broad bounding rectangle (67°E–98°E, 6°N–38°N)** and suppresses clicks on intersecting generic country shapes. This temporarily masks parts of neighboring countries too. The masked rectangle is **not** an international boundary. This is intentional; inaccurate third-party boundaries must not appear as the official map.

To enable India's outline: legally download the **official Survey of India vector outline**, convert it to GeoJSON with QGIS / GDAL if needed, inspect it, and upload it using **Load Survey of India GeoJSON**. Only polygon and multipolygon features inside the expected geographic window are accepted. The browser performs only basic geographic validation, **not authenticity verification**. Clearly record the official download date/version and license. Neighboring territories in the mask are not restored by this upload; a production-grade map needs an authoritative harmonized regional country boundary dataset and topology QA.

The developer has **not** bundled an unverified or license-restricted India GeoJSON. This is safer than falsely claiming official boundaries.

## Inventory provenance / references

- [EDGAR — Emissions Database for Global Atmospheric Research (European Commission JRC)](https://edgar.jrc.ec.europa.eu/) — check the precise POPs species, release, units, countries, and inventory coverage before importing.
- Breivik et al. PCB historical emissions work: identify the specific publication/dataset, congener and scenario before downloading or importing.
- Other national inventories (e.g. EMEP/CEIP, national government reporting) can be normalized to the CSV schema after license and scope verification.

The source labels in the interface are **not an assertion** that published data have been loaded. Initial UI has **zero** emissions and does not use synthetic placeholder numbers.

## Features

- Global interactive choropleth with country click, hover, search and reset
- Year slider and year animation (only imported inventory coverage)
- Pollutant and emissions source controls
- Country totals, share, rank and historic sparkline
- Annual trends and same-year, same-chemical inventory comparison
- Multi-file CSV imports, validation, normalized units, export of current view
- Responsive dark UI; browser-only (data are cleared on reload)
- India official-boundary upload with safe default masking

## Next production improvements

Package reviewed global and Indian boundary geometry locally with documented provenance; build source-specific country-code crosswalk; add ingestion for EDGAR/Breivik releases and DOI/license metadata; provide a country-completeness audit and versioned source manifests; implement precomputed tile / simplified map data, automated tests and accessibility QA.

License of external source datasets and mapping files is **not** implied by this repository.
