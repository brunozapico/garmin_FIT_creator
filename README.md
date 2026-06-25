# Garmin FIT Workout Builder

A simple web app to create structured Garmin workouts from natural language and export them as `.FIT` files, ready to be copied directly to a Garmin device.

The goal is to reduce the friction of creating structured workouts manually in Garmin Connect by allowing users to write a workout in plain language, preview the interpreted structure, edit it if needed, and download a Garmin-compatible workout file.

## What problem does this solve?

Creating structured workouts manually in Garmin Connect can be slow, repetitive, and inconvenient, especially for athletes who already have workouts written on paper, in notes, spreadsheets, or messaging apps.

This app provides a lightweight alternative:

```text
Natural language workout
        ↓
Parsed structured workout
        ↓
Editable preview
        ↓
Garmin .FIT file
        ↓
Copy to Garmin device by USB
```

No Garmin API, account credentials, or third-party approval process is required.

## Key benefits

* Convert workout descriptions into structured Garmin workouts.
* Preview the final workout before generating the file.
* Edit steps manually before export.
* Generate `.FIT` files locally in the browser.
* Avoid manual workout creation in Garmin Connect.
* No backend required.
* No login required.
* No external API dependency.
* Easy to deploy on Vercel.
* Useful for runners, cyclists, coaches, and self-coached athletes.

## Example inputs

You can write workouts in a natural format such as:

```text
20 min easy + 6x800m at 4:30/km with 2 min recovery + 10 min easy
```

```text
15 min warmup + 3x10 min tempo with 3 min jog + 10 min cooldown
```

```text
45 min easy Z2
```

```text
10 min warmup + 8x1 min hard / 1 min easy + 10 min cooldown
```

The app parses the workout, creates a structured preview, and lets you adjust the result before downloading the `.FIT` file.

## Supported workout structure

The app is designed to support common endurance workout patterns:

* Warm-up
* Cool-down
* Easy runs/rides
* Intervals
* Repeats
* Recovery blocks
* Tempo blocks
* Distance-based steps
* Time-based steps
* Pace targets
* Heart-rate style zones
* RPE-style descriptions
* Free text instructions

The first version is intentionally simple and focused on practical usability rather than full Garmin Connect feature parity.

## How the Garmin workflow works

After generating the `.FIT` file:

1. Connect your Garmin device to your computer by USB.
2. Open the Garmin device storage.
3. Copy the `.FIT` file into:

```text
GARMIN/NewFiles
```

If that does not work on your device, try:

```text
GARMIN/Workouts
```

4. Safely eject the device.
5. Open the workout from the training/workouts section on your Garmin device.

This workflow avoids Garmin Connect manual workout creation.

## Important limitations

This app does not connect to Garmin Connect.

It does not use:

* Garmin Connect API
* Garmin Training API
* TrainingPeaks API
* OAuth
* Scraping
* Browser automation
* Username/password login
* Unofficial Garmin Connect integrations

The generated `.FIT` file should be tested on your specific Garmin device. Garmin devices may differ slightly in how they import and display structured workouts.

## Tech stack

* Vite
* React
* TypeScript
* Browser-based `.FIT` generation
* No backend
* No database
* No authentication

## Local development

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Deploying to Vercel

1. Push this repository to GitHub.
2. Go to Vercel.
3. Import the GitHub repository.
4. Use the following settings:

```text
Framework: Vite
Build command: npm run build
Output directory: dist
```

5. Deploy.

## Recommended first test

Start with a simple workout:

```text
10 min easy + 4x1 min hard with 2 min easy + 10 min cooldown
```

Download the `.FIT` file, copy it to your Garmin device, and verify that it appears correctly before using more complex workouts.

## Roadmap

Possible future improvements:

* Better natural language parser
* OCR from handwritten workout photos
* More precise Garmin workout step targets
* Workout templates
* Bulk workout generation
* Calendar planning
* Export history
* Better support for cycling and strength workouts
* Device-specific compatibility notes
* Drag-and-drop workout block editor

## Who is this for?

This project is useful for:

* Runners who plan workouts outside Garmin Connect.
* Cyclists who want a fast way to create interval sessions.
* Coaches who prepare workouts in plain text.
* Athletes who keep workouts in paper notebooks.
* Developers experimenting with Garmin `.FIT` workout generation.
* Anyone who wants a simpler workflow than manually building workouts step by step in Garmin Connect.

## Philosophy

The app follows a simple principle:

> Write the workout once, review it, export it, and run it.

It is not meant to replace Garmin Connect, TrainingPeaks, or coaching platforms. It is meant to remove friction from one specific task: turning human-readable workouts into structured Garmin workout files.

## Disclaimer

This is an independent open-source project. It is not affiliated with, endorsed by, or sponsored by Garmin, TrainingPeaks, or any related company.

Use generated workouts responsibly and test files on your own device before relying on them for important training sessions.