# Firebase role and login setup

1. Open Firebase Authentication and enable Email/Password. Enable Google too if you want Google sign-in.
2. Create each login account in Authentication and copy its exact UID.
3. In Firestore, create `users/{Authentication UID}` using the same UID. Example:

```text
name: "Aarav Sharma"
email: "aarav@example.com"
role: "team_lead"
active: true
team_id: "Creative"
reports_to: "DIRECTOR_UID"
job_title: "Senior Designer"
department: "Creative"
```

Accepted roles:

- `director` → `/director`
- `manager` → `/manager`
- `team_lead` or `team_leader` → `/team-lead`
- `employee` → `/employee`

Legacy `super_admin`/`owner` values map to Director and `admin` maps to Manager for a safe migration. New documents should use the four official values above.

## Important security notes

- Passwords belong only in Firebase Authentication, never in Firestore.
- The app never assigns a default role when a profile is missing.
- `active: false` disables workspace access.
- Publish the included `firestore.rules`; do not keep a broad overlapping allow-write rule.
- The browser cannot create Firebase Authentication accounts or grant roles. The People screen manages the local workspace directory; connect a trusted Admin SDK/Cloud Function when account provisioning is needed.

## Verification

```bash
npm install
npm run build
npm test
```

Sign out and sign in again after changing a role in Firestore. A live login also requires the correct Firebase project and authorized domain.
