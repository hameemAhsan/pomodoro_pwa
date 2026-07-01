# Focus Targets - Custom Pomodoro PWA

A standalone, local-first custom Pomodoro timer for category-based focus tracking.

The app is designed for people who do not only want a timer, but also want to know whether they are meeting daily focus targets for different categories such as MBA Study, Math Research, Business Work, Reading, Content Planning, or any custom category.

---

## 1. Main Idea

The workflow is:

```text
Create category -> Set daily focus target -> Start focus session -> Take break -> Save completed/partial focus time -> Review target performance
```

Only focus time counts toward category targets. Break time does not count.

---

## 2. Features

### Timer

- Custom focus duration
- Custom break duration
- Custom number of rounds
- Category selection before starting
- Optional session note or goal
- Pause and resume
- Reset/end session
- Auto-start break option
- Auto-start next focus option
- Sound alert at the end of focus and break
- Vibration alert where supported
- Browser notification where supported

### Partial Session Handling

If a focus session is paused or interrupted before completion, the app allows:

```text
Save partial time
Discard session
```

Saved partial time is counted toward the selected category.

Discarded time is not counted.

### Categories

Each category has:

- Name
- Daily target focus time
- Color
- Active/inactive status

Examples:

```text
MBA Study - 180 minutes/day
Math Research - 60 minutes/day
Business Work - 120 minutes/day
Reading - 30 minutes/day
```

### Today Dashboard

Shows:

- Total focused time today
- Overall target completion percentage
- Completed focus sessions
- Focus streak
- Category-wise actual vs target progress
- Today’s session list

### Reports

Reports support ranges from:

```text
1 day to 14 days
```

For the selected range, the app shows:

- Total focus time
- Target completion percentage
- Completed sessions
- Category-wise actual vs target performance
- Daily trend chart
- Recent session history

### Export and Backup

- Export session history as CSV
- Export full JSON backup
- Import JSON backup
- Clear local data

---

## 3. Data Storage

This is a no-server app.

Data is stored locally in the browser using local storage.

This means:

- No login required
- No backend required
- No cloud database required
- Data stays on the device/browser
- Data does not automatically sync between devices

Before changing phone/browser or clearing browser data, export a JSON backup.

---

## 4. Folder Structure

```text
custom-pomodoro-pwa/
├── index.html
├── app.js
├── styles.css
├── manifest.json
├── service-worker.js
├── offline.html
├── README.md
├── assets/
│   ├── icon-192.png
│   └── icon-512.png
└── docs/
    └── ACCEPTANCE_CHECKLIST.md
```

For GitHub Pages, `index.html` must be in the repository root.

Correct:

```text
index.html
app.js
styles.css
manifest.json
service-worker.js
assets/
```

Wrong:

```text
custom-pomodoro-pwa/index.html
custom-pomodoro-pwa/app.js
```

---

## 5. How to Use the App

### Step 1: Set Categories

Open the app and go to:

```text
Categories
```

Create your categories and set daily target minutes.

Example:

```text
MBA Study: 180
Math Research: 60
Business Work: 120
Reading: 30
```

### Step 2: Start a Focus Session

Go to:

```text
Focus
```

Select:

- Category
- Focus minutes
- Break minutes
- Rounds
- Optional session note/goal

Then tap:

```text
Start
```

### Step 3: Complete Focus

When the focus timer ends, the app:

- Plays a chime
- Vibrates if supported
- Sends a browser notification if allowed
- Automatically saves the completed focus time to the selected category

### Step 4: Take Break

After focus, the app starts break automatically if auto-break is enabled.

Break time does not count toward focus targets.

### Step 5: Pause or Interrupt

If you pause an unfinished focus session, the app shows:

```text
Save partial
Discard
```

Choose **Save partial** if you want the elapsed focus time to count.

Choose **Discard** if you do not want it counted.

### Step 6: Check Performance

Go to:

```text
Today
```

or:

```text
Reports
```

Reports can be checked from 1 day up to 14 days.

---

## 6. GitHub Pages Deployment

### Step 1: Create Repository

Create a new GitHub repository, for example:

```text
custom-pomodoro-pwa
```

Keep it public if using free GitHub Pages.

### Step 2: Upload Files

Unzip the project.

Upload the contents inside the project folder, not the zip itself.

Upload:

```text
index.html
app.js
styles.css
manifest.json
service-worker.js
offline.html
README.md
assets/
docs/
```

Make sure `assets/icon-192.png` and `assets/icon-512.png` are uploaded.

### Step 3: Enable GitHub Pages

Go to:

```text
Repository -> Settings -> Pages
```

Set:

```text
Source: Deploy from a branch
Branch: main
Folder: /root
```

Click Save.

### Step 4: Wait for Deployment

Go to:

```text
Actions
```

Wait until the Pages deployment becomes green.

### Step 5: Open the App

Your link will look like:

```text
https://YOUR-USERNAME.github.io/custom-pomodoro-pwa/
```

Example:

```text
https://hameemahsan.github.io/custom-pomodoro-pwa/
```

---

## 7. Android Installation

On Android:

1. Open Chrome.
2. Visit the GitHub Pages app link.
3. Wait for the app to fully load.
4. Tap the three-dot menu.
5. Tap **Add to Home screen** or **Install app**.
6. Confirm.

If install does not appear, test these files:

```text
https://YOUR-USERNAME.github.io/custom-pomodoro-pwa/manifest.json
https://YOUR-USERNAME.github.io/custom-pomodoro-pwa/service-worker.js
https://YOUR-USERNAME.github.io/custom-pomodoro-pwa/assets/icon-192.png
https://YOUR-USERNAME.github.io/custom-pomodoro-pwa/assets/icon-512.png
```

All of them must load without 404.

---

## 8. Updating the App on GitHub

To update:

1. Open the repository.
2. Click **Add file -> Upload files**.
3. Upload the corrected files over the old files.
4. Commit the changes.
5. Wait for GitHub Pages deployment to turn green.
6. Hard refresh the app.

On PC:

```text
Ctrl + Shift + R
```

On Android, clear browser cache for the site if the old version still appears.

---

## 9. PWA Cache Troubleshooting

If the app still shows an old version:

1. Open Chrome DevTools.
2. Go to Application.
3. Clear site data.
4. Unregister old service worker.
5. Refresh the page.

For Android:

1. Long press the app icon.
2. Tap App Info.
3. Tap Storage.
4. Clear cache.

Avoid clearing storage unless you have exported a JSON backup, because storage contains your local app data.

---

## 10. Acceptance Checklist

The app is ready when:

- Categories can be created and edited.
- Daily targets can be set per category.
- Focus session can start with selected category.
- Focus and break durations are customizable.
- Timer can pause and resume.
- Completed focus session is saved automatically.
- Partial focus session can be saved or discarded.
- Break time is not counted toward focus targets.
- Chime plays at the end of focus and break.
- Today dashboard updates after saved sessions.
- Reports work from 1 to 14 days.
- CSV export works.
- JSON backup/export works.
- JSON import restores data.
- App works offline after first load.
- App is installable on Android.

---

## 11. Technical Stack

```text
HTML
CSS
JavaScript
LocalStorage
PWA Manifest
Service Worker
No backend
No database server
No login
```

---

## 12. Limitations

This Phase 1 app does not include:

- Cloud sync
- User accounts
- Website blocker
- App blocker
- Multi-device live sync
- Server backup
- AI coaching

It is intentionally local-first, lightweight, and deployable on GitHub Pages.
