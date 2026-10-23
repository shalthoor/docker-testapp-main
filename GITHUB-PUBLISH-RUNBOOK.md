# GitHub Publishing Runbook

This runbook publishes the project in this folder to a new GitHub repository from
Windows PowerShell. It does not publish a Docker image; see the Docker Hub
instructions in `README.md` for that workflow.

## Important project-specific checks

Before making a repository public:

- The Compose YAML files read the MongoDB password from the ignored local
  `.env` file. Copy `.env.example` to `.env` and set a strong local value before
  running Compose. Never commit `.env`; rotate any credential that was previously
  used in a shared environment.
- Review `README.md`, `SOP.md`, and `RUNBOOK.md` for local absolute paths or
  other personal information. Replace such paths with repository-relative
  paths or generic instructions.
- Review `app-users/` and every other file you intend to stage. This project
  currently has an `app-users/server.js`; do not add real user records, database
  dumps, credentials, or private keys.
- `node_modules/`, `cmdhistory.txt`, `tempCodeRunnerFile.js`, `temp`, and
  `Untitled-*.txt` are local/generated artifacts. The root `.gitignore` excludes
  them.
- `.gitignore` prevents new matching files from being staged; it cannot remove
  a file that was already committed or override an explicit `git add -f`.

If a real secret was ever committed, deleting it in a later commit is not
enough: rotate/revoke it. Follow GitHub's guidance for removing sensitive data
from repository history if history cleanup is also required.

## 1. Prerequisites

Install Git for Windows and sign in to GitHub in a browser. GitHub CLI (`gh`)
is optional; Git Credential Manager can authenticate Git pushes through the
browser. Never put a password or personal access token directly in a remote
URL or commit it to a file.

Check Git and move to the project directory:

```powershell
git --version
Set-Location "C:\path\to\docker-testapp-main"
Get-Location
```

The current project folder is not yet a Git repository. If `git status` says
this is not a Git repository, continue with the new-repository workflow below.

## 2. Prepare and review the project

Inspect the files and validate the Node.js entry point:

```powershell
Get-ChildItem -Force
node --check .\server.js
```

Edit any local-only paths or unsafe example configuration identified above.
Keep actual credentials out of source, YAML, Markdown, and GitHub. Use local
environment variables or a secret manager for real credentials.

The project folder is not yet a Git repository, so Git status commands will
work only after the initialization step below.

## 3. Create an empty GitHub repository

On GitHub:

1. Select **New repository**.
2. Choose a repository name, for example `docker-testapp-main`.
3. Choose **Private** initially if you have not completed the public-release
   review.
4. Do not initialize it with a README, license, or `.gitignore`. This project
   already has files, so an empty remote avoids an unrelated first-commit
   history conflict.
5. Create the repository and copy its HTTPS URL. It will look like:
   `https://github.com/YOUR-USERNAME/docker-testapp-main.git`.

## 4. Initialize Git and create the first commit

Run these commands in the project directory:

```powershell
git init -b main
git status --short --ignored
git add -A
git status --short
git diff --cached --check
git diff --cached --stat
git diff --cached
```

Review the staged file list and diff before committing. Confirm that there are
no credentials, personal data, database files, local paths you do not want
public, or generated files. If anything should not be committed, remove it from
the index and update `.gitignore` as appropriate:

```powershell
git restore --staged -- path\to\file
```

After the staged review is clean, set your commit identity if Git has not
already been configured on this computer, then commit:

```powershell
git config user.name "Your Name"
git config user.email "YOUR-EMAIL-OR-GITHUB-NOREPLY-EMAIL"
git commit -m "Initial project import"
```

The `user.email` setting is recorded in commits. Use GitHub's noreply email if
you do not want your personal email exposed.





## 5. Connect the local project to GitHub and push

Replace the example URL with the URL copied from your own GitHub repository:

```powershell
git remote add origin https://github.com/YOUR-USERNAME/docker-testapp-main.git
git remote -v
git push -u origin main
```

Complete the browser sign-in prompt if Git Credential Manager opens it. Do not
paste a token into chat, a script, or the repository.

## 6. Verify the published repository

```powershell
git status --short --branch
git log -1 --oneline
git ls-remote --heads origin
```

Open the repository page in GitHub and confirm that the expected project files
are present, `node_modules/` and local artifacts are absent, and the visibility
setting is correct. If the repository should be public, complete GitHub's
secret/security checks and inspect the files again before changing visibility.

## 7. Publish later changes

After editing files:

```powershell
git status --short
git diff
git add -A
git diff --cached --check
git diff --cached
git commit -m "Describe the change"
git push
```

Always review the staged diff before committing. GitHub receives commits, not
only the latest file contents; never commit a secret even temporarily.

## 8. Common problems

### `git` is not recognized

Install Git for Windows, close and reopen PowerShell, then verify with
`git --version`.

### Authentication failed

Use the browser sign-in flow from Git Credential Manager, or install and
authenticate the GitHub CLI. Do not use a GitHub account password for Git over
HTTPS.

### `remote origin already exists`

Inspect the current remote before changing it:

```powershell
git remote -v
```

If it is incorrect, set the intended URL:

```powershell
git remote set-url origin https://github.com/YOUR-USERNAME/docker-testapp-main.git
```

### Push rejected because the GitHub repository already has commits

This usually means the remote was initialized with a README or another file.
Do not force-push. First inspect the remote and local histories; for a new
repository, the simplest safe option is to create a separate empty GitHub
repository and use its URL.

### A file was already committed despite `.gitignore`

`.gitignore` does not untrack an already committed file. Remove it from Git
tracking while keeping the local copy:

```powershell
git rm --cached -- path\to\file
```

Then add the ignore rule, review the staged diff, commit, and push. If the file
contained a real secret, rotate it immediately and address the exposed history;
do not treat this removal as secret revocation.

## Completion checklist

- [ ] GitHub repository created with intended visibility.
- [ ] Local paths and personal information reviewed.
- [ ] No real credentials, private data, or database dumps are staged.
- [ ] Staged changes reviewed with `git diff --cached`.
- [ ] Initial commit created and pushed to `main`.
- [ ] GitHub page and `git status` confirm the push succeeded.
