
# FlareMap
### Fire Incident Mapping and Location Reporting System

FlareMap is an educational prototype designed to demonstrate environmental monitoring, fire incident reporting, and community awareness through a web-based platform.

## Project Overview

The system provides a centralized dashboard where users can view simulated environmental readings and submit incident reports.

## Features

- Environmental monitoring dashboard
- Simulated temperature, humidity, gas, and carbon monoxide readings
- Monitoring history visualization
- Community incident reporting
- Recent incident reports
- Administrator authentication
- Supabase database integration
- Browser push notification subscription prototype
- Progressive Web App support

## Technologies Used

- HTML
- CSS
- JavaScript
- Supabase
- PostgreSQL
- Supabase Edge Functions
- Web Push API
- GitHub Pages

## Project Structure

```text
FlareMap-Supabase/
├── docs/
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   ├── config.js
│   ├── manifest.json
│   ├── sw.js
│   ├── icons/
│   └── assets/
├── scripts/
│   └── generate-vapid.mjs
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   └── functions/
└── package.json
```

## Configuration

1. Create a Supabase project.
2. Add the project URL and publishable key to `docs/config.js`.
3. Add the VAPID public key to `docs/config.js`.
4. Keep private credentials in Supabase Secrets.
5. Run the database migration.
6. Deploy the Supabase Edge Function.

## Running the Project

The website can be published through GitHub Pages using the `docs` folder as its deployment directory.

## Important Notice

FlareMap is an educational prototype.

Its current environmental readings are simulated and are not actual sensor measurements. It is not a certified fire detection system and must not replace fire alarms, emergency services, or professional safety equipment.

## Project Status

Prototype development and integration.
